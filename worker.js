const TOKEN = "9113514496:AAFJ_w3bymlrzI9ptrjCg5gWvjzCEXnTu-c";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;

export default {
  async fetch(request) {
    if (request.method === "POST") {
      const update = await request.json();
      await handleUpdate(update);
    }
    return new Response("Bot is running!", { status: 200 });
  },
};

async function handleUpdate(update) {
  // 1. Khi có thành viên mới vào nhóm
  if (update.chat_member) {
    const { old_chat_member, new_chat_member } = update.chat_member;
    const chatId = update.chat_member.chat.id;
    const user = new_chat_member.user;

    if (
      ["left", "kicked"].includes(old_chat_member.status) &&
      ["member", "restricted"].includes(new_chat_member.status) &&
      !user.is_bot
    ) {
      // Khóa quyền gửi tin nhắn ngay lập tức
      await callTelegram("restrictChatMember", {
        chat_id: chatId,
        user_id: user.id,
        permissions: { can_send_messages: false },
      });

      // Tạo phép tính ngẫu nhiên
      const a = Math.floor(Math.random() * 10) + 1;
      const b = Math.floor(Math.random() * 10) + 1;
      const ans = a + b;

      // Tạo 4 đáp án (1 đúng, 3 sai) và xáo trộn
      const options = new Set([ans]);
      while (options.size < 4) {
        options.add(Math.floor(Math.random() * 20) + 1);
      }
      const buttons = Array.from(options)
        .sort(() => Math.random() - 0.5)
        .map((num) => ({
          text: `${num}`,
          callback_data: `cap_${user.id}_${num === ans ? "1" : "0"}`,
        }));

      // Gửi tin nhắn xác minh giống mẫu
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: `👋 <b>Chào ${user.first_name}!</b>\n\n🧩 Để tham gia nhóm, hãy bấm đáp án đúng:\n<b>${a} + ${b} = ?</b>\n\n⏱️ Vui lòng xác minh để mở khóa chat.`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [buttons] },
      });
    }
  }

  // 2. Khi thành viên bấm nút chọn đáp án
  if (update.callback_query) {
    const query = update.callback_query;
    const data = query.data;

    if (data.startsWith("cap_")) {
      const [, targetUserId, isCorrect] = data.split("_");
      const clickUserId = query.from.id.toString();
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;

      // Chặn người khác bấm hộ
      if (clickUserId !== targetUserId) {
        await callTelegram("answerCallbackQuery", {
          callback_query_id: query.id,
          text: "⚠️ Nút xác minh này không dành cho bạn!",
          show_alert: true,
        });
        return;
      }

      if (isCorrect === "1") {
        // Mở khóa chat cho thành viên
        await callTelegram("restrictChatMember", {
          chat_id: chatId,
          user_id: clickUserId,
          permissions: {
            can_send_messages: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
          },
        });

        await callTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ <b>${query.from.first_name}</b> đã xác minh thành công!`,
          parse_mode: "HTML",
        });
      } else {
        // Trả lời sai -> Đuổi khỏi nhóm
        await callTelegram("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: `❌ <b>${query.from.first_name}</b> chọn sai đáp án và đã bị mời ra khỏi nhóm.`,
          parse_mode: "HTML",
        });
        await callTelegram("banChatMember", {
          chat_id: chatId,
          user_id: clickUserId,
        });
        // Mở ban ngay để họ có thể xin vào lại sau nếu muốn
        await callTelegram("unbanChatMember", {
          chat_id: chatId,
          user_id: clickUserId,
        });
      }
    }
  }
  
  // 3. Chặn link quảng cáo cơ bản (Tùy chọn)
  if (update.message && update.message.text) {
      const text = update.message.text.toLowerCase();
      if (text.includes("http://") || text.includes("https://") || text.includes("t.me/")) {
          // Xóa tin nhắn chứa link
          await callTelegram("deleteMessage", {
              chat_id: update.message.chat.id,
              message_id: update.message.message_id
          });
      }
  }
}

async function callTelegram(method, body) {
  return fetch(`${API_URL}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
