(function () {
  "use strict";
  const form = document.getElementById("cohamy-import-form");
  const result = document.getElementById("cohamy-import-result");
  const commit = document.getElementById("cohamy-import-commit");
  let job = null;
  function show(data) {
    result.replaceChildren();
    const text = document.createElement("p");
    text.textContent = data.valid !== undefined ? `Tổng ${data.total}; hợp lệ ${data.valid}; lỗi ${data.invalid}. Chưa ghi bài.` : `Đã xử lý ${data.cursor}/${data.total}; tạo ${data.created}; cập nhật ${data.updated}; lỗi ${data.failed}. ${data.done ? "Hoàn tất." : "Đang xử lý…"}`;
    result.appendChild(text);
    if (data.preview) {
      const table = document.createElement("table"); table.className = "widefat";
      const headings = ["row", "locale", "slug", "title", "status", "action"];
      const header = table.insertRow(); headings.forEach((heading) => { const cell = document.createElement("th"); cell.textContent = heading; header.appendChild(cell); });
      data.preview.forEach((row) => { const line = table.insertRow(); headings.forEach((heading) => { line.insertCell().textContent = String(row[heading]); }); }); result.appendChild(table);
    }
    (data.errors || []).forEach((error) => { const line = document.createElement("p"); line.style.color = "#b32d2e"; line.textContent = `Dòng ${error.row}: ${error.reason}`; result.appendChild(line); });
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); commit.hidden = true; job = null;
    try {
      const data = new FormData(form);
      job = await wp.apiFetch({ path: "/cohamy/v1/import/preview", method: "POST", body: data });
      show(job); commit.hidden = job.valid === 0;
    } catch (error) { result.textContent = error.message || "Không thể kiểm tra CSV."; }
  });
  commit.addEventListener("click", async () => {
    if (!job) return;
    commit.disabled = true; let cursor = job.cursor || 0;
    try {
      while (true) {
        const data = await wp.apiFetch({ path: "/cohamy/v1/import/batch", method: "POST", data: { token: job.token, cursor } });
        cursor = data.cursor; job.cursor = cursor; show(data);
        if (data.done) { commit.hidden = true; job = null; break; }
      }
    } catch (error) { const line = document.createElement("p"); line.textContent = error.message || "Batch bị gián đoạn. Bấm ghi để tiếp tục."; result.appendChild(line); }
    finally { commit.disabled = false; }
  });
})();
