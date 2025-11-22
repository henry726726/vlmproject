package com.example.backend.dto;


import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor // 기본 생성자

public class TextGenerationResponse {
    private List<String> adTexts; // 광고 문구 리스트

    
    public TextGenerationResponse(List<String> adTexts) {
        this.adTexts = adTexts;
    }
}