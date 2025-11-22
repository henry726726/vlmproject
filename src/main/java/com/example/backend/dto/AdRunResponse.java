package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdRunResponse {
    private Long adRunId;
    private String adId;
    private String status;
    private OffsetDateTime adModifiedAt;

    // AdContent 내용
    private Long contentId;
    private String product;
    private String target;
    private String purpose;
    private String keyword;
    private String duration;
    private String adText;

    // 이미지 정보
    private String originalImageBase64; // 원본 이미지 (새 합성용)
    private String generatedImageBase64; // 이미 합성된 최종 이미지

    // User 정보
    private String userEmail;
}
