-- Run on the dedicated financial-education DB before deploying the quiz response API.
CREATE TABLE IF NOT EXISTS user_quiz_responses (
  user_id CHAR(36) NOT NULL,
  round_number TINYINT UNSIGNED NOT NULL,
  answers JSON NOT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, round_number),
  CONSTRAINT fk_quiz_responses_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
