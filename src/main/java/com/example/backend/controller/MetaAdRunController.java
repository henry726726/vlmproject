package com.example.backend.controller;

import com.example.backend.dto.AdRunResponse;
import com.example.backend.entity.AdContent;
import com.example.backend.entity.AdRun;
import com.example.backend.entity.User;
import com.example.backend.repository.AdRunRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/meta/ad-runs")
public class MetaAdRunController {

        @Autowired
        private AdRunRepository adRunRepository;

        /**
         * 특정 시간 이전(ad_modified_at 기준)에 수정된 광고 집행 내역을 조회
         *
         * @param hoursSinceModified N시간 전을 기준으로 조회 (기본값 = 24시간)
         * @return 광고 집행 리스트 (DTO 변환)
         */
        @GetMapping("/active")
        public List<AdRunResponse> getActiveAdRuns(
                        @RequestParam(defaultValue = "24") int hoursSinceModified) {
                OffsetDateTime threshold = OffsetDateTime.now().minusHours(hoursSinceModified);
                List<AdRun> adRuns = adRunRepository.findByStatusAndAdModifiedAtBefore("CREATED", threshold);

                return adRuns.stream()
                                .map(adRun -> new AdRunResponse(
                                                adRun.getId(),
                                                adRun.getAdId(),
                                                adRun.getStatus(),
                                                adRun.getAdModifiedAt(),
                                                adRun.getContent().getId(),
                                                adRun.getContent().getProduct(),
                                                adRun.getContent().getTarget(),
                                                adRun.getContent().getPurpose(),
                                                adRun.getContent().getKeyword(),
                                                adRun.getContent().getDuration(),
                                                adRun.getContent().getAdText(),
                                                adRun.getContent().getOriginalImageBase64(), // ✅ 포함
                                                adRun.getContent().getGeneratedImageBase64(),
                                                adRun.getUser().getEmail()))
                                .toList();
        }

}
