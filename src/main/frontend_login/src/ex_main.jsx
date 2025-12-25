import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  MousePointerClick,
  Sparkles,
  BarChart3, // 아이콘 변경 (데이터 분석용)
  RefreshCw, // 아이콘 변경 (순환/교체용)
  Menu,
  Zap, // 아이콘 추가 (속도/편리함)
  Layers, // 아이콘 추가 (레이아웃/계층)
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full font-sans text-gray-900 bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white px-4 py-3 lg:px-6 border-b border-gray-100">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <a
              href="#"
              className="text-3xl font-bold tracking-tight text-[#00C4CC] font-serif italic"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              ADaide
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6 text-[15px] font-medium text-gray-700">
              <a href="#" className="hover:text-purple-600 transition-colors">
                기능 소개
              </a>
              <a href="#" className="hover:text-purple-600 transition-colors">
                작동 방식
              </a>
              <a href="#" className="hover:text-purple-600 transition-colors">
                요금제
              </a>
              <a href="#" className="hover:text-purple-600 transition-colors">
                도움말
              </a>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth/signup")}
              className="hidden lg:block px-5 py-2 text-[15px] font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
            >
              가입
            </button>
            <button
              onClick={() => navigate("/auth/login")}
              className="px-5 py-2 text-[15px] font-bold text-white bg-[#8B3DFF] hover:bg-[#7a30e6] rounded-md transition-colors shadow-sm"
            >
              로그인
            </button>
            <button className="lg:hidden p-2 text-gray-600">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="bg-[#F2F0FF] w-full overflow-hidden">
        <div className="mx-auto max-w-[1440px] px-4 pt-8 pb-20 lg:px-12 lg:pt-12 lg:pb-32">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-12">
            <span className="hover:underline cursor-pointer">홈</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="hover:underline cursor-pointer">
              AI Ad Generator
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium">자동화 광고 관리</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="max-w-xl">
              <div className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider text-purple-600 uppercase bg-purple-100 rounded-full">
                New Project
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-[1.2] text-[#0E101A] mb-6 tracking-tight">
                무엇이든 만드는 <br />
                <span className="text-[#8B3DFF]">AI 광고 자동화</span> 솔루션
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                상품명과 사진만 올리세요. <br className="hidden md:block" />
                <strong>생성부터 배포, 성과 분석 후 교체까지</strong> AI가
                알아서 해드립니다.
              </p>

              <button
                onClick={() => navigate("/auth/login")}
                className="inline-flex items-center justify-center px-8 py-3.5 text-lg font-bold text-white bg-[#8B3DFF] hover:bg-[#7a30e6] rounded-md transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                지금 무료로 시작하기
              </button>
            </div>

            {/* Right Image (Laptop Mockup) */}
            <div className="relative mt-8 lg:mt-0">
              <div className="relative mx-auto w-full max-w-[800px]">
                <div className="relative z-10 overflow-hidden rounded-t-xl bg-gray-800 shadow-2xl border-[12px] border-gray-800 border-b-0 aspect-[16/10]">
                  <div className="h-full w-full bg-white relative group">
                    {/* 메인 이미지: Unsplash의 비즈니스 미팅/발표 이미지로 교체 */}
                    <img
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070"
                      alt="Dashboard Preview"
                      className="w-full h-full object-cover"
                    />

                    {/* Overlay Badges */}
                    <div className="absolute top-6 right-6 bg-white/95 backdrop-blur px-4 py-3 rounded-lg shadow-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <BarChart3 size={20} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">CTR 분석 중</p>
                          <p className="text-sm font-bold text-gray-900">
                            +12.5% 상승
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative z-20 mx-auto h-[24px] w-[110%] -ml-[5%] rounded-b-xl rounded-t-sm bg-gray-700 shadow-xl">
                  <div className="absolute left-1/2 top-0 h-[4px] w-[120px] -translate-x-1/2 rounded-b-lg bg-gray-600"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 👇 [수정됨] 핵심 기능 소개 (요약 버전) */}
      <section className="bg-white py-20 border-b border-gray-100">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              복잡한 광고 관리, AI가 해결합니다
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              전문 지식이 없어도 괜찮습니다. 기획부터 디자인, 성과 관리까지 전
              과정을 자동화했습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 transition-colors duration-300 group cursor-default border border-transparent hover:border-purple-100">
              <div className="w-14 h-14 rounded-xl bg-white text-[#8B3DFF] shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MousePointerClick className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                초간편 시작
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                복잡한 설정 없이 <strong>'상품명'</strong>과{" "}
                <strong>'이미지'</strong>만 입력하세요. 나머지는 시스템이 알아서
                처리합니다.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 transition-colors duration-300 group cursor-default border border-transparent hover:border-purple-100">
              <div className="w-14 h-14 rounded-xl bg-white text-[#8B3DFF] shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                고퀄리티 AI 디자인
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                AI가 문구를 만들고, 멀티모달 AI가 레이아웃과 배경을 디자인하여{" "}
                <strong>전문가급 광고</strong>를 만듭니다.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 transition-colors duration-300 group cursor-default border border-transparent hover:border-purple-100">
              <div className="w-14 h-14 rounded-xl bg-white text-[#8B3DFF] shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                성과 기반 자동 관리
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                광고 성과를 실시간 분석하여,{" "}
                <strong>효율이 떨어지는 광고는 자동으로 내리고</strong> 새
                광고로 교체합니다.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 transition-colors duration-300 group cursor-default border border-transparent hover:border-purple-100">
              <div className="w-14 h-14 rounded-xl bg-white text-[#8B3DFF] shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <RefreshCw className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                피로도 관리 시스템
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                같은 광고가 오래 노출되면 고객이 지루해합니다.{" "}
                <strong>3주마다 자동으로 디자인을 리프레시</strong>합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 👇 [추가됨] 작동 원리 (Pipeline) 소개 */}
      <section className="bg-[#1A0F3D] py-20 text-white overflow-hidden relative">
        {/* 배경 장식 요소 */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[100px]"></div>
        </div>

        <div className="mx-auto max-w-[1440px] px-4 lg:px-12 relative z-10">
          <div className="mb-16 md:text-center">
            <span className="text-[#A8E6CF] font-bold tracking-wider text-sm uppercase mb-2 block">
              How It Works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              4단계 완전 자동화 프로세스
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              생성(Generation)부터 배포(Deployment), 평가(Evaluation),
              교체(Replacement)까지
              <br className="hidden md:block" />
              사용자의 개입을 최소화한 End-to-End 파이프라인입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#8B3DFF] rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                1
              </div>
              <div className="mb-4 text-[#A8E6CF]">
                <Zap className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">문구 생성</h4>
              <p className="text-gray-400 text-sm leading-snug">
                제품명과 타겟을 분석하여 구매를 유도하는 매력적인 광고 카피
                3종을 자동으로 작성합니다.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#8B3DFF] rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                2
              </div>
              <div className="mb-4 text-[#A8E6CF]">
                <Layers className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">디자인 & 레이아웃</h4>
              <p className="text-gray-400 text-sm leading-snug">
                텍스트와 이미지를 이해하는 AI가 요소가 겹치지 않는 최적의
                레이아웃 구도를 설계합니다.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#8B3DFF] rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                3
              </div>
              <div className="mb-4 text-[#A8E6CF]">
                <Sparkles className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">배경 & 합성</h4>
              <p className="text-gray-400 text-sm leading-snug">
                제품과 어울리는 배경을 생성하고, 폰트와 로고를 합성하여 최종
                광고 이미지를 완성합니다.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#8B3DFF] rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                4
              </div>
              <div className="mb-4 text-[#A8E6CF]">
                <RefreshCw className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-bold mb-2">배포 및 순환</h4>
              <p className="text-gray-400 text-sm leading-snug">
                SNS에 자동 업로드하고, 성과가 낮은 광고는 내리고 새로운 광고로
                알아서 교체합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (Simple Version for Landing) */}
      <footer className="bg-white py-12 border-t border-gray-100">
        <div className="mx-auto max-w-[1440px] px-4 text-center text-gray-500 text-sm">
          <p className="mb-2">© 2025 AI Ad Manager. All rights reserved.</p>
          <p>대표: 장민서 | 대표 메일: msj3767@gmail.com</p>
        </div>
      </footer>
    </div>
  );
}
