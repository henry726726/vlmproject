package com.example.backend.meta;

import com.example.backend.entity.Content;
import com.example.backend.repository.AdAccountRepository;
import com.example.backend.repository.ContentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class MetaAdUpdater {

    @Autowired
    private AdAccountRepository adAccountRepository;

    @Autowired
    private ContentRepository contentRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    public void updateAdByContentId(String contentId, String accessToken) {
        System.out.println(" [Start] 광고 업데이트 실행");
        System.out.println(" contentId: " + contentId);

        // 1. 콘텐츠 조회
        Content content = contentRepository.findById(contentId)
                .orElseThrow(() -> new RuntimeException("Content not found"));

        System.out.println(" content.caption: " + content.getCaption());
        System.out.println(" content.imageUrl: " + content.getImageUrl());
        System.out.println(" accessToken: " + accessToken);

        // 2. adAccountId 조회
        String rawAccountId = adAccountRepository.findAll().stream()
                .findFirst().orElseThrow(() -> new RuntimeException("No ad account found")).getAccountId();
        String adAccountId = "act_" + rawAccountId;
        System.out.println(" adAccountId: " + adAccountId);

        // 3. 광고 리스트에서 첫 번째 adId 추출
        String adId = getFirstAdId(adAccountId, accessToken);
        System.out.println("🆔 adId: " + adId);

        // 4. 새로운 creative 생성 및 광고 업데이트
        String creativeId = createNewAdCreative(adAccountId, accessToken, content);
        System.out.println(" creativeId: " + creativeId);
        updateAdCreative(adId, creativeId, accessToken);
    }

    private String getFirstAdId(String adAccountId, String accessToken) {
        String url = "https://graph.facebook.com/v22.0/" + adAccountId + "/ads?fields=id&access_token=" + accessToken;
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("광고 ID 조회 실패: " + response);
        }

        try {
            JsonNode json = objectMapper.readTree(response.getBody());
            JsonNode data = json.path("data");

            if (!data.isArray() || data.size() == 0) {
                throw new RuntimeException("광고 목록이 비어있습니다. 광고를 먼저 생성하세요.");
            }

            return data.get(0).path("id").asText();
        } catch (Exception e) {
            throw new RuntimeException("광고 ID 파싱 실패", e);
        }
    }

    private String createNewAdCreative(String adAccountId, String accessToken, Content content) {
        String url = "https://graph.facebook.com/v22.0/" + adAccountId + "/adcreatives";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("name", "Auto Updated Creative");
        body.add("object_story_spec", String.format(
                "{\"page_id\":\"666307613232481\",\"link_data\":{\"message\":\"%s\",\"link\":\"%s\"}}",
                content.getCaption(), content.getImageUrl()));
        body.add("access_token", accessToken);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

        System.out.println(" AdCreative 요청 응답: " + response.getBody());
        System.out.println(" 응답 코드: " + response.getStatusCode());

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null
                && response.getBody().contains("id")) {
            String responseBody = response.getBody();
            String idPart = responseBody.split("\"id\":\"")[1];
            return idPart.split("\"")[0];
        } else {
            throw new RuntimeException("AdCreative 생성 실패: " + response);
        }
    }

    private void updateAdCreative(String adId, String creativeId, String accessToken) {
        String url = "https://graph.facebook.com/v22.0/" + adId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("creative", String.format("{\"creative_id\":\"%s\"}", creativeId));
        body.add("access_token", accessToken);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("광고 업데이트 실패: " + response);
        }
    }
}
