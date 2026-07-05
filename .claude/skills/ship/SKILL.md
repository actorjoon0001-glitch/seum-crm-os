---
name: ship
description: 현재 변경사항을 새 브랜치 → PR → main 자동 머지로 배포한다. 코드 변경이 준비되면 항상 이 방식으로 반영(직접 push 금지, 매 변경은 개별 PR).
---

# ship — 새 PR로 main에 자동 머지

이 저장소(seum-crm-os)의 모든 변경은 **직접 main에 push하지 않고**, 항상 새 PR을 만들어 곧바로 머지한다. 이 스킬이 호출되거나 변경이 준비되면 아래 순서를 따른다.

1. **빌드 확인**: `npm run build` 로 통과 확인.
2. **브랜치 생성**: `main` 기준으로 새 브랜치 (`feat/<slug>` 또는 `fix/<slug>`).
3. **커밋**: 명확한 한글 메시지. 마지막에 트레일러 추가:
   - `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
   - `Claude-Session: https://claude.ai/code/session_019VZmk4NUfxpWZ42pJwEcQc`
4. **푸시**: `git push -u origin <branch>`.
5. **PR 생성**: `mcp__github__create_pull_request` (head=브랜치, base=`main`). 본문 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. **자동 머지**: `mcp__github__merge_pull_request` (merge_method=`merge`). 리뷰 대기 없이 바로 머지.
7. **배포 브랜치 동기화**: `main` 최신을 배포 브랜치 `claude/keen-galileo-rqdtbd` 로 반영해 push (Netlify가 배포). 로컬 main도 `origin/main` 으로 reset.
8. **정리**: 머지된 feature 브랜치 삭제.

## 원칙
- 매 변경 = 개별 PR. main 직접 push 금지.
- 사용자에게 매번 PR 링크와 결과를 알린다.
- Netlify 프로덕션 브랜치가 `main` 으로 전환되면 7단계(배포 브랜치 동기화)는 생략 가능.
