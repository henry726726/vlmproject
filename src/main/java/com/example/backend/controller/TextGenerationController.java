package com.example.backend.controller;

import com.example.backend.dto.PromptRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TextGenerationController {

    @Value("${openai.api.key}")
    private String apiKey;

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final String MODEL = "gpt-5-nano";

    // ✅ 후보 생성 개수 (Chat Completions의 n: choices 개수)
    private static final int NUM_CHOICES = 5; // 5~10 추천
    private static final int MAX_POOL = 40;   // 후보 풀 최대
    private static final int MAX_REWRITE_ROUNDS = 2;

    // ✅ 룰
    private static final int MAX_LEN = 30;
    private static final List<String> BANNED = List.of("최고의", "완벽한", "프리미엄", "지금 바로", "놓치지 마세요");

    // ✅ 유사도(2-gram Jaccard) 임계치
    private static final double SIM_THRESHOLD = 0.40;

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(Duration.ofSeconds(10))
            .writeTimeout(Duration.ofSeconds(30))
            .readTimeout(Duration.ofSeconds(180))
            .callTimeout(Duration.ofSeconds(180))
            .retryOnConnectionFailure(true)
            // HTTP/2 이슈 의심되면 주석 해제
            // .protocols(List.of(okhttp3.Protocol.HTTP_1_1))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();
    private final MediaType mediaType = MediaType.parse("application/json");

    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody PromptRequest request) {
        try {
            // ✅ 필수값 검증
            String missing = validateRequired(request);
            if (missing != null) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", "필수 입력값이 누락됐어요: " + missing,
                        "adTexts", List.of()
                ));
            }

            // ===== 0) 기본 프롬프트 =====
            String basePrompt = buildBasePrompt(request);

            // ===== 1) 후보 풀 생성 (n=NUM_CHOICES → choices 여러 개) =====
            OpenAIResultMulti gen = callOpenAI_Multi(basePrompt, buildSchema_AdTexts3(), NUM_CHOICES);
            if (gen.errorMessage != null) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", gen.errorMessage,
                        "adTexts", List.of()
                ));
            }
            if (gen.status == 200 && (gen.choiceContents == null || gen.choiceContents.isEmpty())) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", "후보 생성 응답이 비어 있어 생성에 실패했어요. 다시 시도해 주세요.",
                        "adTexts", List.of(),
                        "meta", Map.of("openai_status", gen.status)
                ));
            }

            // choices 각각에서 {"adTexts":[...]} 파싱 → 후보 풀로 합치기
            List<String> pool = new ArrayList<>();
            for (String c : gen.choiceContents) {
                List<String> parsed = tryParseAdTextsObject(c);
                if (parsed == null) {
                    String extracted = extractJsonObject(c);
                    if (extracted != null) parsed = tryParseAdTextsObject(extracted);
                }
                if (parsed != null) pool.addAll(parsed);
            }

            // 후보 정리: trim + 빈값 제거 + 중복 제거 + 너무 길면 제거 + 금칙어 제거
            pool = pool.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .filter(s -> s.length() <= MAX_LEN)
                    .filter(s -> !containsBanned(s))
                    .limit(MAX_POOL)
                    .collect(Collectors.toList());

            // 후보 풀이 너무 적으면 fallback 1회
            if (pool.isEmpty()) {
                OpenAIResultSingle fallback = callOpenAI_Single(basePrompt, buildSchema_AdTexts3());
                if (fallback.errorMessage != null || isEmpty(fallback.content)) {
                    return ResponseEntity.ok(Map.of(
                            "ok", false,
                            "warning", "후보 풀 생성에 실패했어요. 다시 시도해 주세요.",
                            "adTexts", List.of()
                    ));
                }
                List<String> parsed = tryParseAdTextsObject(fallback.content);
                if (parsed != null) pool = parsed;
            }

            // ===== 2) 모델에게 후보 중 상위 3개 선별 =====
            String selectPrompt = buildSelectPrompt(request, pool);

            OpenAIResultSingle selected = callOpenAI_Single(selectPrompt, buildSchema_AdTexts3());
            if (selected.errorMessage != null) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", selected.errorMessage,
                        "adTexts", List.of()
                ));
            }
            if (selected.status == 200 && isEmpty(selected.content)) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", "선별 응답이 비어 있어 생성에 실패했어요. 다시 시도해 주세요.",
                        "adTexts", List.of()
                ));
            }

            List<String> adTexts = tryParseAdTextsObject(selected.content);
            if (adTexts == null) {
                String extracted = extractJsonObject(selected.content);
                if (extracted != null) adTexts = tryParseAdTextsObject(extracted);
            }
            if (adTexts == null || adTexts.size() < 3) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", "선별은 됐지만 형식 파싱에 실패했어요. 다시 시도해 주세요.",
                        "adTexts", List.of()
                ));
            }
            adTexts = adTexts.subList(0, 3).stream().map(String::trim).collect(Collectors.toList());

            // ===== 3) 서버 검증 + 걸린 것만 재작성 루프 =====
            adTexts = validateAndRewriteLoop(request, adTexts);

            if (adTexts == null || adTexts.size() < 3) {
                return ResponseEntity.ok(Map.of(
                        "ok", false,
                        "warning", "최종 문구 생성에 실패했어요. 다시 시도해 주세요.",
                        "adTexts", List.of()
                ));
            }

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "adTexts", adTexts
            ));

        } catch (SocketTimeoutException e) {
            return ResponseEntity.ok(Map.of(
                    "ok", false,
                    "warning", "요청이 시간 초과됐어요. 잠시 후 다시 시도해 주세요.",
                    "adTexts", List.of()
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(Map.of(
                    "ok", false,
                    "warning", "서버 오류로 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
                    "adTexts", List.of(),
                    "detail", e.getMessage()
            ));
        }
    }

    // =========================
    // 0) 필수값 검증 + 프롬프트 빌더
    // =========================
    private String validateRequired(PromptRequest req) {
        List<String> missing = new ArrayList<>();
        if (isBlank(req.getProduct())) missing.add("제품명(product)");
        if (isBlank(req.getBenefit())) missing.add("핵심 베네핏(benefit)");
        if (isBlank(req.getPainPoint())) missing.add("타겟 상황/고통(painPoint)");
        return missing.isEmpty() ? null : String.join(", ", missing);
    }

    private String buildBasePrompt(PromptRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
                # Role
                너는 10년 경력의 퍼포먼스 마케팅 카피라이터다.
                너의 목표는 오직 하나, 스크롤을 멈추고 클릭하게 만드는 것이다.
                점잖거나 설명적인 문구는 혐오하며, 소비자의 본능(불안, 허영, 게으름)을 자극하는 날선 문장을 쓴다.

                # Guidelines (Strict)
                1. 형식: 공백 포함 30자 이내 (한국어). 30자를 넘으면 무조건 실패로 간주하고 다시 쓴다.
                2. 스타일:
                - 주어/조사 과감히 생략. 명사형이나 동사형으로 딱 끊어칠 것.
                - "최고의, 완벽한, 프리미엄, 솔루션, 제공합니다" 같은 마케터들의 게으른 단어 절대 금지.
                - 밈(Meme)이나 유행어 구조를 차용하되, 상품 맥락에 맞게 비틀 것.
                3. 심리 트리거 (다음 3가지 앵글로 각각 1개씩 작성):
                A. 공포/손실 회피 (지금 안 하면 손해, 망가짐)
                B. 밴드왜건 (남들은 이미 다 쓰고 있음, 나만 뒤쳐짐)
                C. 극단적 효율 (귀찮음 해결, 게으른 자를 위한 구원)

                # Examples (Reference)
                - (Bad): 이 베개를 쓰면 잠이 잘 옵니다. (설명적, 지루함)
                - (Good): 눕자마자 기절, 알람 못 들음 주의 (결과 강조, 위트)
                - (Bad): 최고의 다이어트 보조제, 지금 구매하세요. (진부함)
                - (Good): 굶는 다이어트? 촌스럽게 왜 그래 (도발, 공감)
                - (Bad): 영어 공부는 꾸준히 하는 것이 중요합니다. (교과서적)
                - (Good): 야너두? 원어민이 말 걸면 도망가잖아 (팩트 폭력, 패러디)

                # Task
                위 정보를 바탕으로 심리 트리거 A, B, C에 해당하는 초단문 카피 3개를 출력하라.
                먼저 [고객의 페인 포인트]를 한 줄로 분석한 뒤, 카피를 제시하라.

                [입력 정보]
                제품명: %s
                핵심 베네핏: %s
                타겟 상황/고통: %s
                """.formatted(
                req.getProduct().trim(),
                req.getBenefit().trim(),
                req.getPainPoint().trim()
        ));

        // ✅ 선택 필드들(있을 때만 포함)
        if (!isBlank(req.getPromotion())) {
            sb.append("프로모션/가격: ").append(req.getPromotion().trim()).append("\n");
        }
        if (!isBlank(req.getToneGuide())) {
            sb.append("금지 표현/톤 가이드: ").append(req.getToneGuide().trim()).append("\n");
        }

        sb.append("""
                
                출력은 반드시 JSON 객체로만 한다.
                키는 adTexts 하나만 사용하고, adTexts는 문자열 3개 배열이다.
                다른 텍스트는 절대 출력하지 않는다.
                """);

        return sb.toString();
    }

    // =========================
    // A) 핵심: 검증 & 재작성 루프
    // =========================
    private List<String> validateAndRewriteLoop(PromptRequest req, List<String> initial) throws Exception {
        List<String> cur = new ArrayList<>(initial);

        for (int round = 0; round < MAX_REWRITE_ROUNDS; round++) {
            // 1) 개별 문구 검증
            List<Validation> validations = new ArrayList<>();
            for (int i = 0; i < cur.size(); i++) {
                validations.add(validateOne(cur.get(i)));
            }

            // 2) 세트(3개) 검증: 중복/유사도
            SetIssue setIssue = validateSet(cur);

            // 위반 인덱스 수집
            Set<Integer> badIdx = new LinkedHashSet<>();
            for (int i = 0; i < validations.size(); i++) {
                if (!validations.get(i).ok) badIdx.add(i);
            }
            badIdx.addAll(setIssue.badIndices);

            // 전부 OK면 종료
            if (badIdx.isEmpty()) {
                return cur;
            }

            // 3) 위반된 것만 재작성
            for (Integer idx : badIdx) {
                String original = cur.get(idx);

                // 재작성 시, 나머지 두 문구와 겹치지 않도록 같이 넘김
                List<String> others = new ArrayList<>(cur);
                others.remove((int) idx);

                String rewritePrompt = buildRewritePrompt(req, original, validations.get(idx), others);

                OpenAIResultSingle rewritten = callOpenAI_Single(rewritePrompt, buildSchema_AdText1());
                if (rewritten.errorMessage != null || isEmpty(rewritten.content)) {
                    continue;
                }

                String newText = tryParseAdTextObject(rewritten.content);
                if (newText == null) {
                    String extracted = extractJsonObject(rewritten.content);
                    if (extracted != null) newText = tryParseAdTextObject(extracted);
                }
                if (newText != null) cur.set(idx, newText.trim());
            }
        }

        // 최종 정리
        List<String> cleaned = cur.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.length() > MAX_LEN ? s.substring(0, Math.min(s.length(), MAX_LEN)) : s)
                .filter(s -> !containsBanned(s))
                .distinct()
                .collect(Collectors.toList());

        if (cleaned.size() < 3) return null;
        return cleaned.subList(0, 3);
    }

    // =========================
    // B) OpenAI 호출 (temperature 제거)
    // =========================
    private OpenAIResultMulti callOpenAI_Multi(String prompt, Map<String, Object> responseFormat, int n) throws Exception {
        Map<String, Object> message = Map.of("role", "user", "content", prompt);

        Map<String, Object> body = new HashMap<>();
        body.put("model", MODEL);
        body.put("messages", List.of(message));
        body.put("response_format", responseFormat);
        body.put("n", n);
        // ✅ gpt-5-nano는 temperature 커스텀을 지원하지 않아 아예 넣지 않음

        String json = mapper.writeValueAsString(body);

        Request gptRequest = new Request.Builder()
                .url(OPENAI_URL)
                .post(okhttp3.RequestBody.create(json, mediaType))
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .build();

        try (Response response = client.newCall(gptRequest).execute()) {
            int status = response.code();
            ResponseBody rb = response.body();
            String raw = (rb != null) ? rb.string() : "";

            System.out.println("🔎 OpenAI status: " + status);
            System.out.println("🔎 OpenAI raw response:");
            System.out.println(raw);

            String errorMessage = null;
            List<String> contents = new ArrayList<>();

            try {
                JsonNode root = mapper.readTree(raw);

                if (root.has("error")) {
                    errorMessage = root.path("error").path("message").asText("OpenAI error");
                } else {
                    JsonNode choices = root.path("choices");
                    if (choices.isArray()) {
                        for (JsonNode ch : choices) {
                            String content = ch.path("message").path("content").asText(null);
                            if (content != null) contents.add(content);
                        }
                    }
                }
            } catch (Exception ignore) {
            }

            return new OpenAIResultMulti(status, contents, errorMessage);
        }
    }

    private OpenAIResultSingle callOpenAI_Single(String prompt, Map<String, Object> responseFormat) throws Exception {
        OpenAIResultMulti multi = callOpenAI_Multi(prompt, responseFormat, 1);
        String content = (multi.choiceContents != null && !multi.choiceContents.isEmpty())
                ? multi.choiceContents.get(0)
                : null;
        return new OpenAIResultSingle(multi.status, content, multi.errorMessage);
    }

    // =========================
    // C) Structured Outputs: Schema builders
    // =========================
    private Map<String, Object> buildSchema_AdTexts3() {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "adTexts", Map.of(
                                "type", "array",
                                "minItems", 3,
                                "maxItems", 3,
                                "items", Map.of(
                                        "type", "string",
                                        "maxLength", MAX_LEN
                                )
                        )
                ),
                "required", List.of("adTexts")
        );

        return Map.of(
                "type", "json_schema",
                "json_schema", Map.of(
                        "name", "ad_copy_response",
                        "strict", true,
                        "schema", schema
                )
        );
    }

    private Map<String, Object> buildSchema_AdText1() {
        Map<String, Object> schema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "adText", Map.of(
                                "type", "string",
                                "maxLength", MAX_LEN
                        )
                ),
                "required", List.of("adText")
        );

        return Map.of(
                "type", "json_schema",
                "json_schema", Map.of(
                        "name", "ad_copy_rewrite_response",
                        "strict", true,
                        "schema", schema
                )
        );
    }

    // =========================
    // D) Parsing helpers
    // =========================
    private List<String> tryParseAdTextsObject(String content) {
        try {
            JsonNode root = mapper.readTree(content);
            JsonNode arr = root.get("adTexts");
            if (arr == null || !arr.isArray()) return null;
            return mapper.convertValue(arr, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return null;
        }
    }

    private String tryParseAdTextObject(String content) {
        try {
            JsonNode root = mapper.readTree(content);
            JsonNode t = root.get("adText");
            if (t == null || !t.isTextual()) return null;
            return t.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private String extractJsonObject(String s) {
        if (s == null) return null;
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return s.substring(start, end + 1);
        return null;
    }

    private boolean isEmpty(String s) {
        return s == null || s.trim().isEmpty();
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    // =========================
    // E) Selection / Rewrite prompts
    // =========================
    private String buildSelectPrompt(PromptRequest req, List<String> pool) {
        List<String> p = (pool == null) ? List.of() : pool.stream().limit(MAX_POOL).collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        sb.append("""
                너는 10년 경력의 퍼포먼스 광고 카피라이터이자, 냉정한 편집자다.
                아래 후보들 중에서 CTR/전환 관점으로 가장 강한 문구 3개만 고른다.

                규칙:
                - 각 문구 공백 포함 30자 이내
                - 금칙어: 최고의, 완벽한, 프리미엄, 지금 바로, 놓치지 마세요 (절대 금지)
                - 세 문구 간 어휘/표현 중복 최소화(서로 확연히 다르게)
                - 소개형/교과서형 문장 제외, 스크롤 멈추는 후킹 우선

                광고 정보:
                제품명: %s
                핵심 베네핏: %s
                타겟 상황/고통: %s
                """.formatted(
                req.getProduct().trim(),
                req.getBenefit().trim(),
                req.getPainPoint().trim()
        ));

        if (!isBlank(req.getPromotion())) {
            sb.append("프로모션/가격: ").append(req.getPromotion().trim()).append("\n");
        }
        if (!isBlank(req.getToneGuide())) {
            sb.append("금지 표현/톤 가이드: ").append(req.getToneGuide().trim()).append("\n");
        }

        sb.append("\n후보 목록(여기서만 선택):\n");
        for (int i = 0; i < p.size(); i++) {
            sb.append(String.format("%d) %s%n", (i + 1), p.get(i)));
        }

        sb.append("""
                
                출력은 반드시 JSON 객체로만 한다.
                키는 adTexts 하나만 사용하고, adTexts는 문자열 3개 배열이다.
                다른 텍스트는 절대 출력하지 않는다.
                """);

        return sb.toString();
    }

    private String buildRewritePrompt(PromptRequest req, String original, Validation v, List<String> others) {
        String reasons = (v == null || v.reasons.isEmpty()) ? "규칙 위반" : String.join(", ", v.reasons);
        String other1 = others.size() > 0 ? others.get(0) : "";
        String other2 = others.size() > 1 ? others.get(1) : "";

        StringBuilder sb = new StringBuilder();
        sb.append("""
                너는 10년 경력의 퍼포먼스 광고 카피라이터다.
                아래 문구를 규칙을 지켜 더 강하게 '재작성'한다. (의미는 유지하되 후킹 강화)

                반드시 지킬 규칙:
                - 공백 포함 30자 이내
                - 금칙어 절대 금지: 최고의, 완벽한, 프리미엄, 지금 바로, 놓치지 마세요
                - 아래 두 문구와 겹치는 표현/단어를 최대한 피해서, 완전히 다른 느낌으로
                - 설명/소개형 금지, 리듬감 있게 끊기

                광고 정보:
                제품명: %s
                핵심 베네핏: %s
                타겟 상황/고통: %s
                """.formatted(
                req.getProduct().trim(),
                req.getBenefit().trim(),
                req.getPainPoint().trim()
        ));

        if (!isBlank(req.getPromotion())) {
            sb.append("프로모션/가격: ").append(req.getPromotion().trim()).append("\n");
        }
        if (!isBlank(req.getToneGuide())) {
            sb.append("금지 표현/톤 가이드: ").append(req.getToneGuide().trim()).append("\n");
        }

        sb.append("""
                
                재작성 사유: %s

                기존 문구: %s
                다른 문구1: %s
                다른 문구2: %s

                출력은 반드시 JSON 객체로만 한다.
                키는 adText 하나만 사용하고, adText는 문자열 1개다.
                다른 텍스트는 절대 출력하지 않는다.
                """.formatted(
                reasons,
                safeQuote(original),
                safeQuote(other1),
                safeQuote(other2)
        ));

        return sb.toString();
    }

    private String safeQuote(String s) {
        if (s == null) return "";
        return s.replace("\n", " ").trim();
    }

    // =========================
    // F) Validation logic
    // =========================
    private Validation validateOne(String s) {
        List<String> reasons = new ArrayList<>();
        if (s == null || s.trim().isEmpty()) reasons.add("빈 문구");
        if (s != null && s.length() > MAX_LEN) reasons.add("30자 초과");
        if (s != null && containsBanned(s)) reasons.add("금칙어 포함");
        return new Validation(reasons.isEmpty(), reasons);
    }

    private boolean containsBanned(String s) {
        if (s == null) return false;
        for (String b : BANNED) {
            if (s.contains(b)) return true;
        }
        return false;
    }

    private SetIssue validateSet(List<String> three) {
        Set<Integer> bad = new LinkedHashSet<>();

        if (three == null || three.size() < 3) {
            bad.add(0);
            bad.add(1);
            bad.add(2);
            return new SetIssue(bad);
        }

        // 1) 완전 중복
        Map<String, List<Integer>> idxByText = new HashMap<>();
        for (int i = 0; i < three.size(); i++) {
            String t = three.get(i);
            idxByText.computeIfAbsent(t, k -> new ArrayList<>()).add(i);
        }
        for (Map.Entry<String, List<Integer>> e : idxByText.entrySet()) {
            if (e.getValue().size() > 1) bad.addAll(e.getValue());
        }

        // 2) 유사도 검사(2-gram Jaccard)
        for (int i = 0; i < 3; i++) {
            for (int j = i + 1; j < 3; j++) {
                double sim = jaccard2gram(three.get(i), three.get(j));
                if (sim >= SIM_THRESHOLD) {
                    bad.add(j);
                }
            }
        }

        return new SetIssue(bad);
    }

    private double jaccard2gram(String a, String b) {
        Set<String> A = twoGrams(normalize(a));
        Set<String> B = twoGrams(normalize(b));
        if (A.isEmpty() && B.isEmpty()) return 1.0;
        Set<String> inter = new HashSet<>(A);
        inter.retainAll(B);
        Set<String> union = new HashSet<>(A);
        union.addAll(B);
        return union.isEmpty() ? 0.0 : (double) inter.size() / (double) union.size();
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\s\\p{Punct}]+", "");
    }

    private Set<String> twoGrams(String s) {
        Set<String> grams = new HashSet<>();
        if (s == null) return grams;
        if (s.length() < 2) return grams;
        for (int i = 0; i < s.length() - 1; i++) {
            grams.add(s.substring(i, i + 2));
        }
        return grams;
    }

    // =========================
    // G) Result classes
    // =========================
    private static class OpenAIResultMulti {
        final int status;
        final List<String> choiceContents;
        final String errorMessage;

        OpenAIResultMulti(int status, List<String> choiceContents, String errorMessage) {
            this.status = status;
            this.choiceContents = choiceContents;
            this.errorMessage = errorMessage;
        }
    }

    private static class OpenAIResultSingle {
        final int status;
        final String content;
        final String errorMessage;

        OpenAIResultSingle(int status, String content, String errorMessage) {
            this.status = status;
            this.content = content;
            this.errorMessage = errorMessage;
        }
    }

    private static class Validation {
        final boolean ok;
        final List<String> reasons;

        Validation(boolean ok, List<String> reasons) {
            this.ok = ok;
            this.reasons = reasons;
        }
    }

    private static class SetIssue {
        final Set<Integer> badIndices;

        SetIssue(Set<Integer> badIndices) {
            this.badIndices = badIndices;
        }
    }
}
