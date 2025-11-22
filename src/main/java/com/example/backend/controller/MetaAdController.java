package com.example.backend.controller;

import com.example.backend.service.MetaAdService;
import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.entity.AdAccount;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import com.example.backend.repository.AccessTokenRepository;
import com.example.backend.repository.AdAccountRepository;
import com.example.backend.meta.MetaAdUpdater;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/meta")
public class MetaAdController {

    @Autowired
    private MetaAdService metaAdService;

    @Autowired
    private MetaAdUpdater metaAdUpdater;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessTokenRepository accessTokenRepository;

    @Autowired
    private AdAccountRepository adAccountRepository;

    //  테스트용 access token 저장 (user 연결 없음)
    @GetMapping("/adaccounts/testsave")
    public ResponseEntity<?> saveWithToken(@RequestParam String token) {
        metaAdService.saveAdAccountsWithoutUser(token);
        return ResponseEntity.ok(" 테스트 저장 완료");
    }

    @GetMapping("/adaccounts/save")
    public ResponseEntity<?> saveWithLoginUser() {
        // 1. 로그인된 사용자 이메일 가져오기
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        // 2. 이메일 기반 사용자 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(" 사용자 정보 없음"));

        // 3. 해당 사용자로 AccessToken 조회
        AccessTokenEntity tokenEntity = accessTokenRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException(" accessToken이 없습니다. 먼저 저장해주세요."));

        // 4. 저장 로직 실행
        metaAdService.saveAdAccountsForUser(tokenEntity.getAccessToken(), email);

        return ResponseEntity.ok(" 사용자 기반 저장 완료");
    }

    @GetMapping("/adaccounts")
    public ResponseEntity<?> getAdAccountsForUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(" 사용자 없음"));

        List<AdAccount> accounts = adAccountRepository.findByUser(user);
        return ResponseEntity.ok(accounts);
    }

    //  광고 업데이트 테스트용
    @GetMapping("/test-update")
    public ResponseEntity<String> testUpdate(
            @RequestParam String contentId,
            @RequestParam String userId) {
        metaAdUpdater.updateAdByContentId(contentId, userId);
        return ResponseEntity.ok("광고 업데이트 완료");
    }
}
