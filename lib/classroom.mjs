function reply(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function classroom(request, db) {
  try {
    const token = /(?:^|;\s*)classroom=([a-f0-9-]{36})(?:;|$)/.exec(request.headers.get("cookie") || "")?.[1];
    const student = token && await db.prepare("SELECT id, name, room FROM students WHERE session = ?")
      .bind(token).first();
    if (request.method === "GET") {
      if (!student) return reply({ me: null, people: [] });
      const { results } = await db.prepare(`
        SELECT students.id, students.name, trips.id AS turn
        FROM students LEFT JOIN trips ON students.id = trips.student
        WHERE students.room = ?
        ORDER BY trips.id, students.id
      `).bind(student.room).all();
      return reply({ me: student, people: results });
    }

    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return reply({ error: "Ожидается запрос в формате JSON." }, 415);
    }
    const body = await request.json().catch(() => null);
    if (body?.action === "join" && !student) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const room = typeof body.room === "string" ? body.room.trim().toLowerCase() : "";
      if (!name || name.length > 40 || !/^[\p{L}\p{N}_-]{3,32}$/u.test(room)) {
        return reply({ error: "Укажите имя до 40 символов и код пары от 3 до 32 символов." }, 400);
      }
      const session = crypto.randomUUID();
      await db.prepare("INSERT INTO students (session, name, room) VALUES (?, ?, ?)")
        .bind(session, name, room).run();
      const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
      return reply({}, 201, { "Set-Cookie": `classroom=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}` });
    }
    if (!student) return reply({ error: "Сначала присоединитесь к паре." }, 401);
    switch (body?.action) {
      case "request":
        await db.prepare("INSERT INTO trips (student) VALUES (?) ON CONFLICT(student) DO NOTHING")
          .bind(student.id).run();
        break;
      case "finish":
        await db.prepare("DELETE FROM trips WHERE student = ?").bind(student.id).run();
        break;
      case "leave":
        await db.batch([
          db.prepare("DELETE FROM trips WHERE student = ?").bind(student.id),
          db.prepare("DELETE FROM students WHERE id = ?").bind(student.id),
        ]);
        return reply({}, 200, { "Set-Cookie": "classroom=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
      default:
        return reply({ error: "Неизвестное действие." }, 400);
    }
    return reply({});
  } catch (error) {
    console.error(error);
    return reply({ error: "Связь с сервером прервалась. Попробуйте ещё раз." }, 500);
  }
}
