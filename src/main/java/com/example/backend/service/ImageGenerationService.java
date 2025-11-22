// src/main/java/com/example/backend/service/ImageGenerationService.java
package com.example.backend.service;

import java.io.IOException;
import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.example.backend.dto.ComposeResponse;
import com.example.backend.entity.AdContent;
import com.example.backend.entity.AdResultJson;
import com.example.backend.repository.AdContentRepository;
import com.example.backend.repository.AdResultJsonRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class ImageGenerationService {

    @Value("${compose.base-url:http://localhost:8010}")
    private String composeBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper om = new ObjectMapper();

    private final AdContentRepository adContentRepo;
    private final AdResultJsonRepository adResultJsonRepo;

    public ImageGenerationService(AdContentRepository adContentRepo,
                                  AdResultJsonRepository adResultJsonRepo) {
        this.adContentRepo = adContentRepo;
        this.adResultJsonRepo = adResultJsonRepo;
    }

    /**
     * 합성 실행 + DB 저장(원자적).
     * @param caption    광고 문구(=compose에 caption/text 둘 다로 전달)
     * @param image      원본 이미지 파일
     * @param userEmail  저장 주체(필수)
     * @param product    제품명(선택) – 전달 시 Step1의 --product_name으로 연결됨
     * @return 저장된 ad_contents.ad_id (AUTO_INCREMENT)
     */
    @Transactional
    public Long generateAndSave(String caption,
                                MultipartFile image,
                                String userEmail,
                                @org.springframework.lang.Nullable String product) throws Exception {
        if (userEmail == null || userEmail.isBlank()) {
            throw new IllegalArgumentException("userEmail is required");
        }
        if (caption == null) caption = "";

        // 1) 원본 이미지 Base64 (DB 보관용)
        String originalB64 = Base64.getEncoder().encodeToString(toBytes(image));

        // 2) Python compose 서비스 호출
        final String url = composeBaseUrl + "/compose";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ByteArrayResource imageResource = new ByteArrayResource(toBytes(image)) {
            @Override public String getFilename() {
                return image.getOriginalFilename();
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        // compose 측 호환성을 위해 caption/text 모두 전달
        body.add("caption", caption);
        body.add("text", caption);
        body.add("image", imageResource);
        if (product != null && !product.isBlank()) {
            body.add("product", product);
        }

        HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(body, headers);

        ComposeResponse resp = restTemplate.postForObject(url, req, ComposeResponse.class);
        if (resp == null) {
            throw new RuntimeException("compose_service call failed: empty response");
        }
        if (resp.getImageBase64() == null || resp.getImageBase64().isBlank()) {
            throw new RuntimeException("compose_service returned no 'image_base64'");
        }

        // 3) ad_contents 저장
        AdContent ac = new AdContent();
        ac.setUserEmail(userEmail);
        ac.setAdText(caption);
        if (product != null && !product.isBlank()) {
            try {
                // 엔티티에 product 컬럼이 있으면 세팅
                AdContent.class.getMethod("setProduct", String.class).invoke(ac, product);
            } catch (NoSuchMethodException ignore) {
                // 필드가 없으면 무시
            } catch (ReflectiveOperationException e) {
                throw new RuntimeException(e);
            }
        }
        ac.setOriginalImageBase64(originalB64);
        ac.setGeneratedImageBase64(stripDataUrlPrefix(resp.getImageBase64())); // data: 접두사 제거(선택)
        ac = adContentRepo.save(ac); // PK 확보

        // 4) 레이아웃/카피 JSON 저장 (있을 때만)
        if (resp.getLayout() != null) {
            AdResultJson row = new AdResultJson();
            row.setAdContentId(ac.getId());
            row.setJsonType("layout");
            row.setPayload(om.writeValueAsString(resp.getLayout()));
            adResultJsonRepo.save(row);
        }
        if (resp.getCopy() != null) {
            AdResultJson row = new AdResultJson();
            row.setAdContentId(ac.getId());
            row.setJsonType("copy");
            row.setPayload(om.writeValueAsString(resp.getCopy()));
            adResultJsonRepo.save(row);
        }
        // (옵션) meta가 있으면 저장하고 싶을 때:
        try {
            var getMeta = ComposeResponse.class.getMethod("getMeta");
            Object meta = getMeta.invoke(resp);
            if (meta != null) {
                AdResultJson row = new AdResultJson();
                row.setAdContentId(ac.getId());
                row.setJsonType("meta");
                row.setPayload(om.writeValueAsString(meta));
                adResultJsonRepo.save(row);
            }
        } catch (NoSuchMethodException ignored) {
            // DTO에 meta 없으면 패스
        }

        return ac.getId();
    }

    // ----------------- helpers -----------------

    private static String stripDataUrlPrefix(String b64) {
        if (b64 == null) return null;
        int idx = b64.indexOf(',');
        return (idx >= 0) ? b64.substring(idx + 1) : b64;
    }

    private static byte[] toBytes(MultipartFile f) {
        try {
            return f.getBytes();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public String composeProxyPassThrough(MultipartFile resolvedImage, String resolvedProduct, String resolvedText) {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'composeProxyPassThrough'");
    }
}
