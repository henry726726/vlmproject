package com.example.backend.controller;

import com.example.backend.dto.UpdateAdRequest;
import com.example.backend.service.MetaAdCreatorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/meta")
public class MetaAdUpdateController {

    @Autowired
    private MetaAdCreatorService metaAdUpdaterService;

    @PostMapping("/update-ad")
    public ResponseEntity<String> updateAd(@RequestBody UpdateAdRequest request) {
        try {
            metaAdUpdaterService.updateAd(
                    request.getAdRunId(),
                    request.getNewContentId(),
                    request.getUserEmail(),
                    request.getNewText(),
                    request.getNewImageBase64());
            return ResponseEntity.ok(" 광고 업데이트 완료");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(" 광고 업데이트 실패: " + e.getMessage());
        }
    }
}
