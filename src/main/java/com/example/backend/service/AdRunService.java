package com.example.backend.service;

import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import com.example.backend.repository.AdRunRepository;        
import com.example.backend.repository.AccessTokenRepository; 
import com.example.backend.entity.AdRun;                     
import com.example.backend.entity.AccessTokenEntity; 
// AdRunService.java
@Service
@RequiredArgsConstructor
public class AdRunService {
    private final AdRunRepository adRunRepository;
    private final AccessTokenRepository accessTokenRepository;

    public String getAccessTokenForAdRun(Long adRunId) {
        AdRun adRun = adRunRepository.findById(adRunId)
                .orElseThrow(() -> new RuntimeException("AdRun not found"));
        Long userId = adRun.getUser().getId();

        return accessTokenRepository.findByUserId(userId)
                .map(AccessTokenEntity::getAccessToken)
                .orElseThrow(() -> new RuntimeException("Access token not found"));
    }
}