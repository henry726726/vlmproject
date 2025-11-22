package com.example.backend.security;

import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.entity.User;
import com.example.backend.repository.AccessTokenRepository;
import com.example.backend.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class CustomOAuth2SuccessHandler implements AuthenticationSuccessHandler {

    @Autowired
    private OAuth2AuthorizedClientService clientService;

    @Autowired
    private AccessTokenRepository tokenRepo;

    @Autowired
    private UserRepository userRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {

        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;

        OAuth2AuthorizedClient client = clientService.loadAuthorizedClient(
                oauthToken.getAuthorizedClientRegistrationId(),
                oauthToken.getName());

        String accessToken = client.getAccessToken().getTokenValue();
        String email = oauthToken.getPrincipal().getAttribute("email");

        //  이메일로 User 객체 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(" 사용자 정보를 찾을 수 없습니다."));

        //  기존 토큰 있으면 업데이트, 없으면 새로 저장
        AccessTokenEntity existing = tokenRepo.findByUserId(user.getId()).orElse(null);
        AccessTokenEntity token;

        if (existing != null) {
            existing.setAccessToken(accessToken);
            token = existing;
        } else {
            token = AccessTokenEntity.builder()
                    .accessToken(accessToken)
                    .user(user)
                    .build();
        }

        tokenRepo.save(token);

        response.sendRedirect("/home"); // 로그인 후 리디렉션
    }
}
