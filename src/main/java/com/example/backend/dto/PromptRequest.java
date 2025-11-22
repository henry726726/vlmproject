package com.example.backend.dto;

public class PromptRequest {

    private String product;
    private String target;
    private String purpose;
    private String keyword;
    private String duration;

    // 생성자
    public PromptRequest() {
    }

    public PromptRequest(String product, String target, String purpose, String keyword, String duration) {
        this.product = product;
        this.target = target;
        this.purpose = purpose;
        this.keyword = keyword;
        this.duration = duration;
    }

    // Getters & Setters
    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }
}
