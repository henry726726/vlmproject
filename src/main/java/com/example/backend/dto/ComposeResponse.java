package com.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter @Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ComposeResponse {
    private String imageBase64; // image_base64 -> imageBase64 로 자동 매핑
    private Object layout;      // Map<String,Object> 또는 Object
    private Object copy;        // 동일
    // 필요 시 meta, debug 등 추가 필드도 허용
}
