import type { UIStrings } from "../types";

export default {
  nav: {
    home: "홈",
    posts: "글",
    tags: "태그",
    about: "소개",
    archives: "아카이브",
    search: "검색",
  },
  post: {
    publishedAt: "발행",
    updatedAt: "수정",
    sharePostIntro: "공유하기:",
    sharePostOn: "{{platform}}에 공유",
    sharePostViaEmail: "이메일로 공유",
    tagLabel: "태그",
    backToTop: "맨 위로",
    goBack: "뒤로",
    editPage: "글 수정",
    previousPost: "이전 글",
    nextPost: "다음 글",
  },
  pagination: {
    prev: "이전",
    next: "다음",
    page: "페이지",
  },
  home: {
    socialLinks: "채널",
    featured: "주목할 글",
    recentPosts: "최신 글",
    allPosts: "전체 글 보기",
  },
  footer: {
    copyright: "Copyright",
    allRightsReserved: "All rights reserved.",
  },
  pages: {
    tagTitle: "태그",
    tagDesc: "이 태그가 달린 글",

    tagsTitle: "태그",
    tagsDesc: "블로그에서 사용한 태그 모음입니다.",

    postsTitle: "전체 글",
    postsDesc: "카드 보기와 사진 없는 리스트 보기를 선택할 수 있습니다.",

    archivesTitle: "아카이브",
    archivesDesc: "월별 글 모음입니다.",

    searchTitle: "검색",
    searchDesc: "글을 검색하세요.",
  },
  a11y: {
    skipToContent: "본문으로 이동",
    openMenu: "메뉴 열기",
    closeMenu: "메뉴 닫기",
    toggleTheme: "테마 전환",
    searchPlaceholder: "글 검색...",
    noResults: "검색 결과가 없습니다",
    goToPreviousPage: "이전 페이지로 이동",
    goToNextPage: "다음 페이지로 이동",
  },
  notFound: {
    title: "404 Not Found",
    message: "페이지를 찾을 수 없습니다",
    goHome: "홈으로 돌아가기",
  },
} satisfies UIStrings;
