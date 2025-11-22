// src/main/java/com/example/backend/controller/ImageController.java
package com.example.backend.controller;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;            //  추가
import org.springframework.util.StringUtils;                   //  추가
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import lombok.RequiredArgsConstructor;

import com.example.backend.service.ImageGenerationService;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
// (개발용) 프론트 도메인으로 교체 권장. 임시로 전체 허용.
// @CrossOrigin(origins = "http://localhost:3000")
public class ImageController {

    private final ImageGenerationService imageGenerationService;

    @PostMapping(
        value = "/generate-image",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Map<String, Object>> generateImage(
            @RequestParam("caption") String caption,
            @RequestParam("image") MultipartFile image,
            @RequestParam(value = "product", required = false) String product,
            @RequestParam(value = "userEmail", required = false) String userEmail,
            Authentication auth
    ) throws Exception {

        //  인증 우선 → 없으면 요청 파라미터로 폴백
        String email = null;
        if (auth != null && auth.isAuthenticated()) {
            String name = auth.getName();
            if (StringUtils.hasText(name) && !"anonymousUser".equals(name)) {
                email = name;
            }
        }
        if (!StringUtils.hasText(email) && StringUtils.hasText(userEmail)) {
            email = userEmail;
        }

        //  최종 이메일 없으면 명확히 실패 처리(엔티티가 NOT NULL이므로)
        if (!StringUtils.hasText(email)) {
            return ResponseEntity.status(401).body(Map.of(
                "message", "로그인이 필요합니다. (userEmail 없음)"
            ));
        }

        Long id = imageGenerationService.generateAndSave(caption, image, email, product); // ✅ userEmail 전달
        return ResponseEntity.ok(Map.of("adContentId", id, "message", "saved"));
    }
}
