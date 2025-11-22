package com.example.backend.service;

import com.example.backend.entity.AdAccount;
import com.example.backend.entity.User;
import com.example.backend.repository.AdAccountRepository;
import com.example.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class MetaAdService {

    @Autowired
    private AdAccountRepository adAccountRepo;

    @Autowired
    private UserRepository userRepository;

    //  원래 있던 기본 메서드 복원 (User 없이 저장)
    public void saveAdAccounts(String accessToken) {
        saveAdAccountsInternal(accessToken, null);
    }

    //  로그인 사용자 기반 저장
    public void saveAdAccountsForUser(String accessToken, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        saveAdAccountsInternal(accessToken, user);
    }

    //  명시적으로 User 없이 저장
    public void saveAdAccountsWithoutUser(String accessToken) {
        saveAdAccountsInternal(accessToken, null);
    }

    //  공통 저장 로직 (비즈니스 계정 여부 상관없이 전체 광고 계정 저장)
    private void saveAdAccountsInternal(String accessToken, User user) {
        RestTemplate restTemplate = new RestTemplate();

        try {
            //  광고 계정 전체 조회
            String adAccountUrl = "https://graph.facebook.com/v20.0/me/adaccounts?fields=id,account_id,name&access_token="
                    + accessToken;
            JsonNode adAccountsJson = restTemplate.getForObject(adAccountUrl, JsonNode.class);
            System.out.println("▶ 내 광고 계정 응답:\n" + adAccountsJson.toPrettyString());

            //  페이지 목록 조회
            String pageUrl = "https://graph.facebook.com/v20.0/me/accounts?access_token=" + accessToken;
            JsonNode pagesJson = restTemplate.getForObject(pageUrl, JsonNode.class);
            System.out.println("▶ 페이지 목록 응답:\n" + pagesJson.toPrettyString());

            for (JsonNode account : adAccountsJson.path("data")) {
                String adId = account.path("id").asText();
                String accountId = account.path("account_id").asText();
                String name = account.path("name").asText();

                for (JsonNode page : pagesJson.path("data")) {
                    String pageId = page.path("id").asText();

                    //  인스타그램 ID 조회
                    String instaUrl = "https://graph.facebook.com/v20.0/" + pageId +
                            "?fields=instagram_business_account&access_token=" + accessToken;
                    JsonNode instaJson = restTemplate.getForObject(instaUrl, JsonNode.class);

                    String instagramId = null;
                    JsonNode instaNode = instaJson.get("instagram_business_account");
                    if (instaNode != null && instaNode.has("id")) {
                        instagramId = instaNode.get("id").asText();
                    }

                    //  저장
                    AdAccount ad = new AdAccount();
                    ad.setAccountId(accountId);
                    ad.setName(name);
                    ad.setPageId(pageId);
                    ad.setInstagramId(instagramId);
                    ad.setUser(user); // null 허용

                    adAccountRepo.save(ad);
                }
            }

            System.out.println(" 광고 계정 저장 완료");

        } catch (Exception e) {
            System.out.println(" 저장 중 오류 발생");
            e.printStackTrace();
        }
    }
}
