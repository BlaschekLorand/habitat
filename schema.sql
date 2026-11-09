-- Habitat database schema (MySQL / MariaDB, InnoDB, utf8mb4)

CREATE TABLE IF NOT EXISTS apartments (
  id      VARCHAR(32)   NOT NULL PRIMARY KEY,
  name    VARCHAR(100)  NOT NULL,
  budget  DECIMAL(14,2) NULL,
  sort    INT           NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
  id            VARCHAR(32)   NOT NULL PRIMARY KEY,
  apartment_id  VARCHAR(32)   NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  budget        DECIMAL(14,2) NULL,
  sort          INT           NOT NULL DEFAULT 0,
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
  id        VARCHAR(32)  NOT NULL PRIMARY KEY,
  room_id   VARCHAR(32)  NOT NULL,
  name      VARCHAR(150) NOT NULL,
  qty       INT          NOT NULL DEFAULT 1,
  priority  VARCHAR(10)  NOT NULL DEFAULT 'Medium',
  status    VARCHAR(20)  NOT NULL DEFAULT 'Researching',
  sort      INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS options (
  id       VARCHAR(32)   NOT NULL PRIMARY KEY,
  item_id  VARCHAR(32)   NOT NULL,
  name     VARCHAR(200)  NOT NULL,
  price    DECIMAL(14,2) NULL,
  store    VARCHAR(150)  NOT NULL DEFAULT '',
  dims     VARCHAR(150)  NOT NULL DEFAULT '',
  url      VARCHAR(1000) NOT NULL DEFAULT '',
  img      MEDIUMTEXT    NULL,
  notes    TEXT          NULL,
  fav      TINYINT(1)    NOT NULL DEFAULT 0,
  sort     INT           NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO apartments (id, name, budget, sort) VALUES
  ('apt115', '115', NULL, 0),
  ('apt111', '111', NULL, 1);
