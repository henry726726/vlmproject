package com.example.backend.service;

import com.example.backend.dto.SaveAdContentRequest;
import com.example.backend.entity.AdContent;
import com.example.backend.repository.AdContentRepository;
import org.springframework.stereotype.Service;

// 광고 콘텐츠 저장 비즈니스 로직을 처리하는 서비스 클래스
@Service

public class AdContentService {

    private final AdContentRepository adContentRepository; // 레포지토리 주입 (final로 선언됨)

    
    public AdContentService(AdContentRepository adContentRepository) {
        this.adContentRepository = adContentRepository;
    }

    public AdContent findByIdOrThrow(Long id) {
    return adContentRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("Not found: " + id));
}

    public AdContent saveAdContent(SaveAdContentRequest request, String userEmail) {
        AdContent adContent = new AdContent();
        adContent.setAdText(request.getAdText());
        adContent.setGeneratedImageBase64(request.getGeneratedImageBase64());
        adContent.setOriginalImageBase64(request.getOriginalImageBase64());
        adContent.setProduct(request.getProduct());
        adContent.setTarget(request.getTarget());
        adContent.setPurpose(request.getPurpose());
        adContent.setKeyword(request.getKeyword());
        adContent.setDuration(request.getDuration());
        adContent.setUserEmail(userEmail);

        return adContentRepository.save(adContent);
    }
}