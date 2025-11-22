package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "ad_contents",
    indexes = {
        @Index(name = "idx_ad_contents_user_email_created", columnList = "userEmail, createdAt")
    }
)
@Getter
@Setter
@NoArgsConstructor
public class AdContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id") 
    private Long id;

    @Column(length = 255)
    private String product;
    @Column(length = 255)
    private String target;
    @Column(length = 255)
    private String purpose;
    @Column(length = 255)
    private String keyword;
    @Column(length = 255)
    private String duration;

    // 광고 문구: TEXT면 충분, DB 이식성↑ 위해 columnDefinition 제거
    @Lob
    private String adText;

    // 원본/합성 이미지는 LOB로만 지정(이식성↑). MySQL에선 LONGTEXT/CLOB로 매핑됨
    @Lob
    private String originalImageBase64;

    @Lob
    private String generatedImageBase64;

    // 파이프라인에서 항상 세팅할 수 있으면 false 유지, 아니면 true로 임시 완화
    @Column(nullable = false, length = 255)
    private String userEmail;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
