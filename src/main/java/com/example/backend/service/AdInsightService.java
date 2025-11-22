package com.example.backend.service;

import com.example.backend.entity.AdInsight;
import com.example.backend.repository.AdInsightRepository;
import com.example.backend.repository.AdRunRepository;
import com.example.backend.repository.AccessTokenRepository;
import com.example.backend.entity.AdRun;
import com.example.backend.entity.AccessTokenEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;


@Service
@RequiredArgsConstructor
public class AdInsightService {

    
    private final AdInsightRepository insightRepository;
    private final AdRunRepository adRunRepository;
    private final AccessTokenRepository accessTokenRepository;

    public void fetchAndStoreInsightsByAdRunId(Long adRunId) {
        // 1. 광고 집행 가져오기
        AdRun adRun = adRunRepository.findById(adRunId)
                .orElseThrow(() -> new RuntimeException("AdRun not found"));

        // 2. User → AccessToken 찾기
        Long userId = adRun.getUser().getId();
        String accessToken = accessTokenRepository.findByUserId(userId)
                .map(AccessTokenEntity::getAccessToken)
                .orElseThrow(() -> new RuntimeException("AccessToken not found for userId=" + userId));

        // 3. Facebook Graph API 호출
        String adId = adRun.getAdId();
        fetchAndStoreInsights(adId, accessToken);
    }

    public AdInsight getLatestInsight(String adId) {
    return insightRepository.findTopByAdIdOrderByDateDesc(adId)
            .orElseThrow(() -> new RuntimeException("No insights found for adId=" + adId));
}

    public void fetchAndStoreInsights(String adId, String accessToken) {
        //  age, gender는 fields가 아니라 breakdowns로 요청해야 함
        String url = String.format(
                "https://graph.facebook.com/v20.0/%s/insights?fields=impressions,clicks,spend,reach,cpc,ctr,frequency&date_preset=last_90d&access_token=%s",
                adId, accessToken);

        try {
            RestTemplate restTemplate = new RestTemplate();
            String json = restTemplate.getForObject(url, String.class);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);
            JsonNode dataArray = root.get("data");

            if (dataArray == null || !dataArray.isArray() || dataArray.size() == 0) {
                System.out.println("⚠️ 광고 성과 데이터가 없습니다.");
                return;
            }

            for (JsonNode node : dataArray) {
                AdInsight insight = new AdInsight();
                insight.setAdId(adId);

                // 안전하게 값 추출
                String age = node.path("age").isMissingNode() ? null : node.path("age").asText();
                String gender = node.path("gender").isMissingNode() ? null : node.path("gender").asText();

                int impressions = node.path("impressions").asInt(0);
                int clicks = node.path("clicks").asInt(0);
                BigDecimal spend = new BigDecimal(node.path("spend").asText("0"));
                int reach = node.path("reach").asInt(0);
                BigDecimal cpc = new BigDecimal(node.path("cpc").asText("0"));
                BigDecimal ctr = new BigDecimal(node.path("ctr").asText("0"));
                BigDecimal frequency = new BigDecimal(node.path("frequency").asText("0"));

                insight.setAge(age);
                insight.setGender(gender);
                insight.setImpressions(impressions);
                insight.setClicks(clicks);
                insight.setSpend(spend);
                insight.setReach(reach);
                insight.setCpc(cpc);
                insight.setCtr(ctr);
                insight.setFrequency(frequency);
                insight.setDate(LocalDate.now());

                System.out.println(" 저장 데이터: " + insight);
                insightRepository.save(insight);
            }

            System.out.println(" 성과 데이터 저장 완료");

        } catch (Exception e) {
            System.out.println(" 성과 데이터 저장 실패");
            e.printStackTrace();
        }
    }
}
