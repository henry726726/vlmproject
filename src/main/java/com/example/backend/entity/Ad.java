package com.example.backend.entity;

import jakarta.persistence.*;

@Entity
public class Ad {

    @Id
    @Column(name = "ad_id")
    private String adId; // 광고 ID 명확하게 지정

    private String name;
    private String status;

    @ManyToOne
    @JoinColumn(name = "ad_account_id", referencedColumnName = "id")
    private AdAccount adAccount;

    // Getters and Setters
    public String getAdId() {
        return adId;
    }

    public void setAdId(String adId) {
        this.adId = adId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public AdAccount getAdAccount() {
        return adAccount;
    }

    public void setAdAccount(AdAccount adAccount) {
        this.adAccount = adAccount;
    }
}
