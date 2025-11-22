package com.example.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 프론트 savePayload와 1:1 매핑 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SaveAdContentRequest {

    private String product;
    private String target;
    private String purpose;
    private String keyword;
    private String duration;

    private String adText;

    // 혹시 프론트/다른 클라이언트가 snake_case로 보낼 때를 대비한 alias
    @JsonProperty("generatedImageBase64")
    private String generatedImageBase64;

    @JsonProperty("originalImageBase64")
    private String originalImageBase64;
}
