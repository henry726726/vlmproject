package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

import com.example.backend.entity.UserDataInput;

@Entity
public class Content {

    @Id
    private String id;

    // @ManyToOne: 여러 콘텐츠가 하나의 아이디에 연결됨
    // @JoinColumn: 외래키 이름을 DB에 명시적으로 지정
    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserDataInput userdatainput;

    private String caption;
    @Column(length = 1000)
    private String imageUrl;
    private LocalDateTime createdAt = LocalDateTime.now();

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UserDataInput getUserdatainput() {
        return userdatainput;
    }

    public void setUserdatainput(UserDataInput userdatainput) {
        this.userdatainput = userdatainput;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

}
