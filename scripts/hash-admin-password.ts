import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error(
    'Cách dùng: npm run admin:hash -- "mat-khau-manh". Không lưu lệnh này vào file hoặc Git.',
  );
  process.exitCode = 1;
} else if (password.length < 12) {
  console.error("Mật khẩu quản trị phải có ít nhất 12 ký tự.");
  process.exitCode = 1;
} else {
  console.log(await bcrypt.hash(password, 12));
}
