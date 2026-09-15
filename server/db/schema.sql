-- db/schema.sql
SET NAMES utf8mb4;
SET time_zone = '+09:00';

START TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
    user_id CHAR(36) NOT NULL,
    nickname VARCHAR(255) NOT NULL unique,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    role ENUM('admin','user','guest') NOT NULL DEFAULT 'user',
    PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS discussions (
    discussion_id VARCHAR(36) NOT NULL,
    video_id VARCHAR(36) NOT NULL,
    topic TEXT NOT NULL,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    PRIMARY KEY (discussion_id),
    KEY ix_discussions_video_id (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id VARCHAR(36) NOT NULL,
    discussion_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tagged_trait ENUM('금융이해','위험인식','계획성','실천의지','기타') NOT NULL,
    PRIMARY KEY (message_id),
    KEY ix_chat_messages_discussion_id (discussion_id),
    KEY ix_chat_messages_user_id (user_id),
    CONSTRAINT fk_chat_messages_discussion
        FOREIGN KEY (discussion_id) REFERENCES discussions(discussion_id)
        ON DELETE CASCADE ON UPDATE RESTRICT
    -- user_id 외래키는 users 테이블이 정의되어 있어야 추가 가능
    -- CONSTRAINT fk_chat_messages_user
    --    FOREIGN KEY (user_id) REFERENCES users(user_id)
    --    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(36) NOT NULL,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reactions (
    reaction_id VARCHAR(36) NOT NULL,
    message_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('공감','좋아요','웃음','기타') NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reaction_id),
    KEY ix_reactions_message_id (message_id),
    KEY ix_reactions_user_id (user_id),
    CONSTRAINT fk_reactions_message
        FOREIGN KEY (message_id) REFERENCES chat_messages(message_id)
        ON DELETE CASCADE ON UPDATE RESTRICT
    -- user_id 외래키는 users 테이블 생성 후 추가 가능
    -- CONSTRAINT fk_reactions_user
    --     FOREIGN KEY (user_id) REFERENCES users(user_id)
    --     ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS badges (
    badge_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    trait ENUM('금융이해','위험인식','계획성','실천의지','기타') NOT NULL,
    awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (badge_id),
    KEY ix_badges_user_id (user_id)
    -- CONSTRAINT fk_badges_user
    --     FOREIGN KEY (user_id) REFERENCES users(user_id)
    --     ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dashboard_summaries (
    summary_id VARCHAR(36) NOT NULL,
    round_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    top_trait ENUM('금융이해','위험인식','계획성','실천의지','기타') NOT NULL,
    most_reacted_user VARCHAR(36) NOT NULL,
    chat_count INT NOT NULL,
    summary_json JSON NOT NULL,
    PRIMARY KEY (summary_id),
    KEY ix_dashboard_summaries_round_id (round_id),
    KEY ix_dashboard_summaries_user_id (user_id)
    -- FOREIGN KEY 설정은 관련 테이블 생성 후 추가 가능
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS overall_summaries (
    overall_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    total_rounds INT NOT NULL,
    overall_trait ENUM('금융이해','위험인식','계획성','실천의지','기타') NOT NULL,
    growth_score FLOAT NOT NULL,
    total_data_json JSON NOT NULL,
    PRIMARY KEY (overall_id),
    KEY ix_overall_summaries_session_id (session_id),
    KEY ix_overall_summaries_user_id (user_id)
    -- FOREIGN KEY 설정은 관련 테이블 생성 후 추가 가능
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ===== Add Foreign Keys after table creation =====
-- quizzes.round_id -> rounds.round_id

-- chat_messages.user_id -> users.user_id
ALTER TABLE chat_messages
  ADD CONSTRAINT fk_chat_messages_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- reactions.user_id -> users.user_id
ALTER TABLE reactions
  ADD CONSTRAINT fk_reactions_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- badges.user_id -> users.user_id
ALTER TABLE badges
  ADD CONSTRAINT fk_badges_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- dashboard_summaries.user_id -> users.user_id
ALTER TABLE dashboard_summaries
  ADD CONSTRAINT fk_dashboard_summaries_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;

-- overall_summaries.user_id -> users.user_id
ALTER TABLE overall_summaries
  ADD CONSTRAINT fk_overall_summaries_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE RESTRICT;


-- 유저별 3라운드 점수를 한 행에 저장 (세션 미사용)
CREATE TABLE IF NOT EXISTS user_round_scores (
    user_id       VARCHAR(36) NOT NULL,
    round1_score  DECIMAL(6,3) NULL,
    round2_score  DECIMAL(6,3) NULL,
    round3_score  DECIMAL(6,3) NULL,
    round4_score  DECIMAL(6,3) NULL,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_round_scores_user
      FOREIGN KEY (user_id) REFERENCES users(user_id)
      ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;