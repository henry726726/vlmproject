package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
public class UserDataInput {

    @Id
    private String id; // ex: 프론트에서 넘긴 유저 ID (userId, UUID 등)

    private String name; // 사용자 이름 (또는 닉네임)
    private String product; // 제품명
    private String target; // 타겟 (ex. 30대 여성)
    private String purpose; // 목적 (구매 유도 등)
    private String keyword; // 강조 키워드
    private String duration; // 광고 기간

    private LocalDateTime createdAt = LocalDateTime.now();

    //  연관 콘텐츠 리스트 (1:N)
    @OneToMany(mappedBy = "userdatainput", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Content> contents = new ArrayList<>();

    // --- 생성자 ---
    public UserDataInput() {
    }

    public UserDataInput(String id, String name, String product, String target,
            String purpose, String keyword, String duration) {
        this.id = id;
        this.name = name;
        this.product = product;
        this.target = target;
        this.purpose = purpose;
        this.keyword = keyword;
        this.duration = duration;
        this.createdAt = LocalDateTime.now();
    }

    // --- Getters and Setters ---
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<Content> getContents() {
        return contents;
    }

    public void setContents(List<Content> contents) {
        this.contents = contents;
    }

    public void addContent(Content content) {
        contents.add(content);
        content.setUserdatainput(this);
    }

    public void removeContent(Content content) {
        contents.remove(content);
        content.setUserdatainput(null);
    }
}
