package com.example.backend.dto;

import lombok.Data;

@Data
public class UpdateAdRequest {
    private Long adRunId;
    private Long newContentId;
    private String userEmail;
    private String newText; // 새 문구
    private String newImageBase64; // 새 합성 이미지(Base64)
}
