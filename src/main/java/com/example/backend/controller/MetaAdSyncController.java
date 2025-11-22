package com.example.backend.controller;

import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.service.AdSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.example.backend.entity.User;
import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.repository.UserRepository;
import com.example.backend.repository.AccessTokenRepository;

@RestController
@RequestMapping("/meta")
public class MetaAdSyncController {

    @Autowired
    private AdSyncService adSyncService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessTokenRepository accessTokenRepository;

    @GetMapping("/sync-ads")
    public String syncAds(@RequestParam String adAccountId) {
        // 1. 로그인한 사용자 email
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        // 2. 유저 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(" 사용자 정보 없음"));

        // 3. Meta access token 조회
        AccessTokenEntity tokenEntity = accessTokenRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException(" Meta access token이 없습니다."));

        // 4. 광고 동기화
        adSyncService.syncAdsFromMeta(adAccountId, tokenEntity.getAccessToken());

        return " 광고 정보 동기화 완료 (DB 저장됨)";
    }
}
