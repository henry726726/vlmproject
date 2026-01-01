package com.example.backend.dto;

public class PromptRequest {

    // ✅ 필수
    private String product;    // 제품명
    private String benefit;    // 핵심 베네핏 1줄
    private String painPoint;  // 타겟 상황/고통 1줄

    // ✅ 선택
    private String promotion;  // 프로모션/가격
    private String toneGuide;  // 금지 표현/톤 가이드

    // 기본 생성자
    public PromptRequest() {
    }

    // 모든 필드 생성자
    public PromptRequest(String product, String benefit, String painPoint, String promotion, String toneGuide) {
        this.product = product;
        this.benefit = benefit;
        this.painPoint = painPoint;
        this.promotion = promotion;
        this.toneGuide = toneGuide;
    }

    // Getters & Setters
    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getBenefit() {
        return benefit;
    }

    public void setBenefit(String benefit) {
        this.benefit = benefit;
    }

    public String getPainPoint() {
        return painPoint;
    }

    public void setPainPoint(String painPoint) {
        this.painPoint = painPoint;
    }

    public String getPromotion() {
        return promotion;
    }

    public void setPromotion(String promotion) {
        this.promotion = promotion;
    }

    public String getToneGuide() {
        return toneGuide;
    }

    public void setToneGuide(String toneGuide) {
        this.toneGuide = toneGuide;
    }
}
