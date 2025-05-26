"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../services/api";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [createMsg, setCreateMsg] = useState("");
  const router = useRouter();

  // Função para login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Permite login por id, handle, cpf ou email
      const userInfo = await api.getUserInfo(user);
      if (!userInfo || !userInfo.id) {
        setError('Usuário não encontrado');
        return;
      }
      // Senha é o número do id
      if (password !== String(userInfo.id)) {
        setError('Senha incorreta');
        return;
      }
      // Login OK
      localStorage.setItem('userId', String(userInfo.id));
      document.cookie = `user=${userInfo.id}; path=/;`;
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  // Função para criar conta
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg("");
    setError("");
    setLoading(true);
    try {
      if (!newHandle) throw new Error("Digite um handle");
      
      console.log('Criando nova conta com handle:', newHandle);
      // Cria usuário
      const res = await api.createUser({ handle: newHandle });
      console.log('Resposta da API ao criar conta:', res);

      const userId = res.user_id || res.id; // compatível com ambos

      if (!userId) {
        console.error('Resposta da API ao criar conta:', res);
        if (res && res.message) throw new Error(res.message);
        if (res && res.error) throw new Error(res.error);
        throw new Error("Erro ao criar conta");
      }

      setCreateMsg(`Conta criada! Seu id: ${userId}`);
      // Login automático
      localStorage.setItem('userId', String(userId));
      document.cookie = `user=${userId}; path=/;`;
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Erro ao criar conta:', err);
      // Melhor tratamento de erros específicos
      if (err.message?.includes('handle has already been taken')) {
        setError('Este nome de usuário já está em uso. Por favor, escolha outro.');
      } else if (err.message?.includes('network')) {
        setError('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        setError(err.message || 'Erro ao criar conta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Vídeo de fundo */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover z-0"
        src="/CWSite_PlanetReel_v1_delivery.mp4"
      />
      {/* Overlay para escurecer o vídeo */}
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-40 z-0" />
      {/* Container centralizado */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center font-sans bg-transparent px-2 sm:px-0">
        <div className="w-full max-w-md bg-white/20 backdrop-blur-3xl shadow-2xl rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-12 flex flex-col items-center gap-6 sm:gap-8">
          <img src="/CloudWalk-logo2.png" alt="Logo" className="w-24 h-12 sm:w-28 sm:h-14 object-contain mb-2 drop-shadow-2xl" />
          <h1 className="text-white text-2xl sm:text-3xl font-extrabold mb-2 text-center">Bem-vindo!</h1>
          <p className="text-white/80 text-base sm:text-lg font-medium mb-4 text-center">Acesse sua conta para continuar</p>
          {!showCreate ? (
            <>
              <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 sm:gap-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Handle ou ID do usuário"
                    value={user}
                    onChange={e => setUser(e.target.value)}
                    className="w-full rounded-full border-2 border-white/30 px-4 py-3 sm:px-6 sm:py-4 bg-white/70 text-base sm:text-lg shadow font-medium placeholder-gray-500 backdrop-blur-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                    autoFocus
                    disabled={loading}
                  />
                  <p className="text-white/60 text-xs mt-1 ml-4">Use seu handle (ex: clarawalk) ou ID</p>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Senha (seu ID)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-full border-2 border-white/30 px-4 py-3 sm:px-6 sm:py-4 bg-white/70 text-base sm:text-lg shadow font-medium placeholder-gray-500 backdrop-blur-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                    disabled={loading}
                  />
                  <p className="text-white/60 text-xs mt-1 ml-4">Use seu ID como senha</p>
                </div>
                {error && (
                  <div className="text-red-500 bg-white/80 rounded-xl px-4 py-2 text-center font-semibold shadow transition-all animate-pulse break-words text-sm sm:text-base">{error}</div>
                )}
                <button
                  type="submit"
                  className="w-full px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full font-bold text-base sm:text-lg shadow-lg hover:from-indigo-600 hover:to-blue-600 transition-transform hover:scale-105 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
              <button
                className="mt-2 text-indigo-200 hover:text-white font-semibold underline transition-all text-sm sm:text-base"
                onClick={() => { setShowCreate(true); setError(""); setCreateMsg(""); }}
                disabled={loading}
              >
                Criar conta
              </button>
            </>
          ) : (
            <form onSubmit={handleCreate} className="w-full flex flex-col gap-4 sm:gap-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Novo handle (ex: clarawalk)"
                  value={newHandle}
                  onChange={e => setNewHandle(e.target.value)}
                  className="w-full rounded-full border-2 border-white/30 px-4 py-3 sm:px-6 sm:py-4 bg-white/70 text-base sm:text-lg shadow font-medium placeholder-gray-500 backdrop-blur-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  autoFocus
                  disabled={loading}
                />
                <p className="text-white/60 text-xs mt-1 ml-4">Escolha um nome de usuário único</p>
              </div>
              {createMsg && (
                <div className="text-green-600 bg-white/80 rounded-xl px-4 py-2 text-center font-semibold shadow transition-all animate-pulse break-words text-sm sm:text-base">{createMsg}</div>
              )}
              {error && (
                <div className="text-red-500 bg-white/80 rounded-xl px-4 py-2 text-center font-semibold shadow transition-all animate-pulse break-words text-sm sm:text-base">{error}</div>
              )}
              <button
                type="submit"
                className="w-full px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-green-500 to-green-400 text-white rounded-full font-bold text-base sm:text-lg shadow-lg hover:from-green-600 hover:to-green-500 transition-transform hover:scale-105 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Criando..." : "Criar conta"}
              </button>
              <button
                type="button"
                className="mt-2 text-indigo-200 hover:text-white font-semibold underline transition-all text-sm sm:text-base"
                onClick={() => { setShowCreate(false); setError(""); setCreateMsg(""); }}
                disabled={loading}
              >
                Voltar para login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 