package com.example.backend.controller;

import com.example.backend.dto.SaveAdContentRequest;
import com.example.backend.entity.AdContent;
import com.example.backend.service.AdContentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ad-content")
public class AdContentController {

    private final AdContentService adContentService;

    public AdContentController(AdContentService adContentService) {
        this.adContentService = adContentService;
    }

    /** 저장 API (기존) */
    @PostMapping("/save")
    public ResponseEntity<?> saveAdContent(@RequestBody SaveAdContentRequest request,
                                           Authentication authentication,
                                           @RequestHeader(name = "X-User-Email", required = false) String headerEmail) {
        try {
            String userEmail = null;

            // 1) 인증에서 이메일 추출
            if (authentication != null && authentication.isAuthenticated()) {
                String name = authentication.getName();
                if (StringUtils.hasText(name) && !"anonymousUser".equals(name)) {
                    userEmail = name;
                }
            }
            // 2) 헤더 폴백 (선택)
            if (!StringUtils.hasText(userEmail) && StringUtils.hasText(headerEmail)) {
                userEmail = headerEmail;
            }
            // 3) (선택) 바디 폴백: DTO에 userEmail 필드가 있다면 사용
            // if (!StringUtils.hasText(userEmail) && StringUtils.hasText(request.getUserEmail())) {
            //     userEmail = request.getUserEmail();
            // }

            if (!StringUtils.hasText(userEmail)) {
                return ResponseEntity.status(401).body(Map.of(
                        "message", "로그인이 필요합니다. (userEmail 없음)"
                ));
            }

            AdContent saved = adContentService.saveAdContent(request, userEmail);
            return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "saved"));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "message", "저장 중 오류",
                    "error", e.getMessage()
            ));
        }
    }

    /**
     *  옵션 B용 조회 API
     * 프론트가 /api/generate-image 응답의 adContentId로 호출해서
     * generatedImageBase64를 가져가 미리보기에 사용.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getAdContent(@PathVariable Long id) {
        try {
            AdContent ac = adContentService.findByIdOrThrow(id); // 서비스에 아래 시그니처 추가 필요
            return ResponseEntity.ok(Map.of(
                    "id", ac.getId(),
                    "userEmail", ac.getUserEmail(),
                    "adText", ac.getAdText(),
                    "generatedImageBase64", ac.getGeneratedImageBase64(),
                    "createdAt", ac.getCreatedAt()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of(
                    "message", "광고 콘텐츠를 찾을 수 없습니다.",
                    "error", e.getMessage()
            ));
        }
    }
}
