package com.example.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MetaAdCreationRequest {
    private Long contentId;
    private String billingEvent;
    private String optimizationGoal;
    private String bidStrategy;
    private String dailyBudget;
    private String startTime;
    private String link;
    private String accountId;
    private String pageId;
}
