require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ecoscore";

async function createAdminOnAtlas() {
  try {
    console.log("🔗 Conectando ao MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado ao MongoDB Atlas!");

    const { Empresa, Admin } = require("./database");

    // Criar Empresa
    let empresa = await Empresa.findOne({ email: "ecoscore994@gmail.com" });
    if (!empresa) {
      empresa = await Empresa.create({
        nome: "EcoScore",
        email: "ecoscore994@gmail.com",
        senha: "ecoscoreadmin", // Middleware do schema vai criptografar
      });
      console.log("✅ Empresa criada no Atlas");
    } else {
      console.log("ℹ️  Empresa já existe no Atlas");
    }

    // Criar Admin
    const adminExists = await Admin.findOne({
      usuario: "admin",
      empresa_id: empresa._id,
    });
    if (!adminExists) {
      await Admin.create({
        usuario: "admin",
        senha: "ecoscoreadmin", // Middleware do schema vai criptografar
        empresa_id: empresa._id,
      });
      console.log(
        "✅ Admin criado no Atlas: ecoscore994@gmail.com / ecoscoreadmin",
      );
    } else {
      console.log("ℹ️  Admin já existe no Atlas");
    }

    console.log("\n✨ Dados criados com sucesso no MongoDB Atlas!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro:", err.message);
    console.error("Stack:", err.stack);
    process.exit(1);
  }
}

createAdminOnAtlas();
