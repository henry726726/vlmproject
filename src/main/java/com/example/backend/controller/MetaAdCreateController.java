package com.example.backend.controller;

import com.example.backend.dto.MetaAdCreationRequest;
import com.example.backend.service.MetaAdCreatorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/meta")
public class MetaAdCreateController {

    @Autowired
    private MetaAdCreatorService metaAdCreatorService;

    @PostMapping("/create-ad")
    public ResponseEntity<String> createAd(@RequestBody MetaAdCreationRequest request) {
        metaAdCreatorService.createInitialAd(request); //  서비스 메서드 이름 일치
        return ResponseEntity.ok(" 광고 생성 완료 (POST 기반)");
    }
}
