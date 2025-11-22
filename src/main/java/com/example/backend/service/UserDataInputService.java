package com.example.backend.service;

import com.example.backend.entity.Content;
import com.example.backend.entity.UserDataInput;
import com.example.backend.repository.ContentRepository;
import com.example.backend.repository.UserDataInputRepository;

import jakarta.annotation.PostConstruct;

import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Service
public class UserDataInputService {

    @Autowired
    private UserDataInputRepository userdataRepo;

    @Autowired
    private ContentRepository contentRepo;

    public void saveContent(String userdatainputId, String caption, String imageUrl) {
        System.out.println(" 저장 시도: " + caption + " / " + imageUrl);
        // 문구 + url을 통해서 고유한 해시값(id) 만들어냄
        // 문구랑 url이 같으면 동일한 해시값 생성되므로 중복 방지
        String hash = DigestUtils.sha256Hex(caption + imageUrl);
        if (contentRepo.existsById(hash))
            return;

        UserDataInput input = userdataRepo.findById(userdatainputId)
                .orElseThrow(() -> new RuntimeException("UserDataInput not found"));

        Content content = new Content();
        content.setId(hash);
        content.setCaption(caption);
        content.setImageUrl(imageUrl);
        content.setCreatedAt(LocalDateTime.now());
        content.setUserdatainput(input);

        contentRepo.save(content);

        System.out.println(" 저장 요청: " + caption);
        System.out.println(" 저장 ID: " + hash);
        System.out.println(" 저장 대상 userdatainputId: " + userdatainputId);

    }
}
