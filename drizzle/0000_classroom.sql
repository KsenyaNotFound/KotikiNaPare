CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  session TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  room TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX students_room ON students (room);
--> statement-breakpoint
CREATE TABLE trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  student INTEGER NOT NULL UNIQUE REFERENCES students (id) ON DELETE CASCADE
);