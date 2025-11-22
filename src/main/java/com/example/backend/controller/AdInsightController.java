package com.example.backend.controller;

import java.util.Map;
import com.example.backend.entity.AdInsight;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import com.example.backend.service.AdInsightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/meta")
public class AdInsightController {

    @Autowired
    private AdInsightService adInsightService;

    @GetMapping("/insight")
    public String getInsights(
            @RequestParam String adId,
            @RequestParam String accessToken) {

        adInsightService.fetchAndStoreInsights(adId, accessToken);
        return " 광고 성과 저장 완료";
    }

    @GetMapping("/insight/test")
    public String testInsight() {
        adInsightService.fetchAndStoreInsights("test_ad_123", null);
        return " 테스트용 성과 저장 완료";
    }

    @PostMapping("/insights/fetch-and-save")
    public ResponseEntity<String> fetchAndSave(@RequestBody Map<String, Object> body) {
        Long adRunId = Long.valueOf(body.get("adRunId").toString());
        try {
            adInsightService.fetchAndStoreInsightsByAdRunId(adRunId);
            return ResponseEntity.ok(" 성과 저장 완료 (adRunId=" + adRunId + ")");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(" 성과 저장 실패: " + e.getMessage());
        }
    }

    @GetMapping("/insights/{adId}/latest")
    public ResponseEntity<AdInsight> getLatestInsight(@PathVariable String adId) {
        AdInsight latest = adInsightService.getLatestInsight(adId);
        return ResponseEntity.ok(latest);
    }
}
