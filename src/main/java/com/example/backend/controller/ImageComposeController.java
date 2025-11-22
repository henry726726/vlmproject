// src/main/java/com/example/backend/controller/ImageComposeController.java
package com.example.backend.controller;

import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.font.TextLayout;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Map;

import javax.imageio.ImageIO;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.backend.service.ImageGenerationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageComposeController {

    private final ImageGenerationService imageGenerationService;

    /**
     * 로컬에서 이미지에 텍스트만 합성하는 엔드포인트
     * (경로를 /overlay 로 분리하여 /compose 프록시와 충돌 방지)
     */
    @PostMapping(
        value = "/overlay",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.IMAGE_PNG_VALUE
    )
    public ResponseEntity<byte[]> overlayText(
            @RequestParam("image") MultipartFile file,
            @RequestParam("text") String text) throws IOException {

        // 1) 원본 이미지 읽기
        BufferedImage img = ImageIO.read(file.getInputStream());
        if (img == null) {
            throw new IOException("Cannot read the uploaded file as an image.");
        }
        int w = img.getWidth(), h = img.getHeight();

        // 2) Graphics2D 설정
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // 3) 한글 폰트 불러오기 (resources/fonts/NanumGothic.ttf)
            Font baseFont;
            try (InputStream fontStream = getClass().getResourceAsStream("/fonts/NanumGothic.ttf")) {
                if (fontStream == null) {
                    // 폰트를 못 찾으면 기본 SansSerif로 대체
                    baseFont = new Font("SansSerif", Font.PLAIN, 36);
                } else {
                    baseFont = Font.createFont(Font.TRUETYPE_FONT, fontStream);
                }
            } catch (FontFormatException e) {
                baseFont = new Font("SansSerif", Font.PLAIN, 36);
            }

            // 4) 폰트 및 색상 설정
            int fontSize = Math.max(w, h) / 15;
            Font font = baseFont.deriveFont(Font.BOLD, (float) fontSize);
            g.setFont(font);
            g.setColor(Color.WHITE);
            g.setStroke(new BasicStroke(fontSize / 10f));
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.9f));

            // 5) 텍스트 위치 계산 (하단 중앙)
            FontMetrics fm = g.getFontMetrics();
            int textWidth = fm.stringWidth(text);
            int x = (w - textWidth) / 2;
            int y = h - fm.getDescent() - fontSize / 2;

            // 6) 텍스트 그리기 (외곽선 + 채우기)
            g.setColor(Color.BLACK);
            TextLayout tl = new TextLayout(text, font, g.getFontRenderContext());
            Shape outline = tl.getOutline(null);
            g.translate(x, y);
            g.draw(outline);

            g.setColor(Color.WHITE);
            g.fill(outline);
            g.translate(-x, -y);
        } finally {
            g.dispose();
        }

        // 7) PNG 변환 및 반환
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", baos);
            baos.flush();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"composite.png\"")
                    .contentType(MediaType.IMAGE_PNG)
                    .body(baos.toByteArray());
        }
    }

    /**
     * Python compose 서비스로 포워딩하는 프록시 엔드포인트
     * - 파일: image 또는 image_file 중 하나
     * - 텍스트: text/headline/caption 중 첫 번째 비어있지 않은 값
     * - 제품명: product/productName/product_name 중 첫 번째 비어있지 않은 값
     */
    @PostMapping(
        value = "/compose",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Map<String, Object>> composeProxy(
            // 파일: image 또는 image_file 중 아무거나
            @RequestPart(value = "image", required = false) MultipartFile image,
            @RequestPart(value = "image_file", required = false) MultipartFile imageFile,

            // 텍스트 파라미터 (multipart에서 String은 RequestParam/Part 둘 다 가능)
            @RequestParam(value = "product", required = false) String product,
            @RequestParam(value = "text", required = false) String text,

            // 기존/대체 키들
            @RequestParam(value = "productName", required = false) String productName,
            @RequestParam(value = "product_name", required = false) String product_name,

            @RequestParam(value = "headline", required = false) String headline,
            @RequestParam(value = "caption", required = false) String caption,

            @RequestParam(value = "logoPath", required = false) String logoPath,
            @RequestParam(value = "logo_path", required = false) String logo_path,

            @RequestParam(value = "fontKor", required = false) String fontKor,
            @RequestParam(value = "font_kor", required = false) String font_kor
    ) {
        // 1) 이름 정규화
        MultipartFile resolvedImage = (image != null) ? image : imageFile;
        if (resolvedImage == null || resolvedImage.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image or image_file is required");
        }

        String resolvedProduct  = firstNonEmpty(product, productName, product_name);
        String resolvedText     = firstNonEmpty(text, headline, caption);
        String resolvedLogoPath = firstNonEmpty(logoPath, logo_path);
        String resolvedFontKor  = firstNonEmpty(fontKor, font_kor);

        // 2) 서비스로 위임 (compose_service.py에 맞게 키 매핑)
        String base64 = imageGenerationService.composeProxyPassThrough(
                resolvedImage,
                resolvedProduct,
                resolvedText
        );
        // 필요 시 logoPath/fontKor를 서비스 메서드 확장으로 전달하세요.

        return ResponseEntity.ok(Collections.singletonMap("image_base64", base64));
    }

    private String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
