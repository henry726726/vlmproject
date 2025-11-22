package com.example.backend.dto;

public class ImageRequest {
    private String product;
    private String text;
    
    private String imageId;

    // 공통 파라미터
    private String productName;
    private String headline;
    private String logoPath;   // 서버 내 파일 경로 쓰는 경우만
    private String fontKor;    // 기본값은 백엔드에서 채움 (e.g., "C:\\Windows\\Fonts\\malgunbd.ttf")

    public String getProduct() {
        return product;
    }

    public void setProduct(String product) {
        this.product = product;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}