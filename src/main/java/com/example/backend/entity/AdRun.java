// src/main/java/com/example/backend/entity/AdRun.java
package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "ad_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- 필수 관계 ---
    // 기존 AdContent -> Content(문자열 PK)로 교체
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "content_id", referencedColumnName = "id", nullable = false)
    private AdContent content;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // --- 집행에 필요한 기본 컨텍스트 ---
    @Column(name = "account_id", nullable = false, length = 64)
    private String accountId;

    @Column(name = "page_id", nullable = false, length = 64)
    private String pageId;

    @Column(name = "link", nullable = false, length = 1024)
    private String link;

    @Column(name = "billing_event", length = 64)
    private String billingEvent;

    @Column(name = "optimization_goal", length = 64)
    private String optimizationGoal;

    @Column(name = "bid_strategy", length = 64)
    private String bidStrategy;

    @Column(name = "daily_budget", nullable = false, length = 32)
    private String dailyBudget;

    @Column(name = "start_time")
    private OffsetDateTime startTime; // 광고 시작 예정일시

    @Column(name = "image_generated_at")
    private OffsetDateTime imageGeneratedAt; // 이미지 생성 시점

    @Column(name = "ad_modified_at")
    private OffsetDateTime adModifiedAt; // 광고 수정(업데이트) 시점

    // --- 페이스북 결과 ID ---
    @Column(name = "campaign_id", length = 64)
    private String campaignId;

    @Column(name = "adset_id", length = 64)
    private String adsetId;

    @Column(name = "creative_id", length = 64)
    private String creativeId;

    @Column(name = "ad_id", length = 64)
    private String adId;

    // --- 상태 ---
    @Column(name = "status", length = 32)
    private String status;

    // --- 감사 필드 ---
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
