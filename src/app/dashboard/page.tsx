'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../services/api';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { userDb } from '../../services/userDb'; // ajuste o caminho se necessário

interface Message {
  role: 'user' | 'agent';
  content: string;
}

interface Transaction {
  id: number;
  amount: number;
  status: 'success' | 'failed';
  date: string;
  recipient: string;
}

interface ReceiptInfo {
  amount: number;
  status: 'success' | 'failed';
  date: string;
  recipient: string;
  method?: string;
}

interface TransactionData {
  amount: number;
  to_user_id?: number;
  to_handle?: string;
  cpf?: string;
  handle?: string;
  user_id?: number;
  payment_method?: string;
  originalIdentifier?: string;
}

interface ReceiptData {
  amount: number;
  recipient: string;
  date: string;
  method: string;
}

interface UserInfo {
  id: number;
  handle: string;
  pix_key?: string;
  email?: string;
  cpf?: string;
}

// Add this function before the DashboardPage component
const addTransaction = (prev: Transaction[], newTx: Omit<Transaction, 'id'>) => {
  const nextId = prev.length > 0 ? Math.max(...prev.map(t => t.id)) + 1 : 1;
  return [...prev, { ...newTx, id: nextId }];
};

// Add this function before the DashboardPage component
const handleTransaction = async (
  userId: number,
  resolvedToId: number,
  data: TransactionData,
  method: string,
  currentBalance: number,
  txDate: string,
  stateSetters: {
    setBalance: (balance: number) => void,
    setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void,
    setShowShareButtons: (show: boolean) => void,
    setLastReceiptTx: (tx: ReceiptInfo) => void,
    setError: (error: string) => void,
    setJustTransferred: (flag: boolean) => void,
    setPollingBlocked: (flag: boolean) => void
  },
  currentTransactions: Transaction[]
) => {
  if (!method) {
    stateSetters.setError('Método de pagamento não especificado');
    return 'Erro: Método de pagamento não especificado';
  }
  const safeMethodStr: string = method || '';
  console.log('Entrou em handleTransaction', { userId, resolvedToId, data, method: safeMethodStr, currentBalance, txDate });
  let balanceInCents = 0;
  try {
    if (!resolvedToId || isNaN(resolvedToId) || resolvedToId <= 0) {
      stateSetters.setError('ID do destinatário inválido');
      return 'Erro: ID do destinatário inválido';
    }

    // 1. Executa a transação
    if (safeMethodStr.includes('PIX')) {
      await api.transferPix({
        to_user_id: resolvedToId,
        amount: Number(data.amount)
      });
    } else if (safeMethodStr === 'POS') {
      await api.transferMoney({ 
        ...data, 
        payment_method: 'debit', 
        to_user_id: resolvedToId 
      });
    } else if (safeMethodStr === 'LINK') {
      await api.payLink({ 
        ...data, 
        from_user_id: userId, 
        to_user_id: resolvedToId 
      });
    } else if (safeMethodStr === 'MPOS') {
      stateSetters.setError('MPOS ainda não está disponível nesta aplicação.');
      return;
    } else if (safeMethodStr === 'CARTÃO' || safeMethodStr === 'CARTAO' || safeMethodStr === 'CARD') {
      await api.cardPayment({ user_id: userId, amount: data.amount, store_name: 'Loja Exemplo' });
    } else {
      stateSetters.setError('Método não reconhecido. Por favor, responda com PIX, POS, Link, MPOS ou Cartão.');
      return;
    }

    // 2. Atualiza o saldo localmente
    const newBalance = currentBalance - Number(data.amount);
    stateSetters.setBalance(newBalance);
    balanceInCents = newBalance;

    // 3. Atualiza o saldo do destinatário localmente, se for o painel dele
    let newRecipientBalance = 0;
    if (typeof window !== 'undefined') {
      const recipientKey = `balance_${resolvedToId}`;
      const prevRecipientBalance = Number(localStorage.getItem(recipientKey)) || 0;
      newRecipientBalance = prevRecipientBalance + Number(data.amount);
      localStorage.setItem(recipientKey, String(newRecipientBalance));
    }

    // 4. Sincroniza com o backend (em background)
    setTimeout(async () => {
      try {
        const balanceInReais = balanceInCents / 100;
        await api.setBalance({ user_id: userId, balance: balanceInReais });
        await api.setBalance({ user_id: resolvedToId, balance: newRecipientBalance / 100 });
        console.log('Saldos sincronizados após transação:', { 
          sender: balanceInReais, 
          recipient: newRecipientBalance / 100 
        });
      } catch (error) {
        console.error('Erro ao sincronizar saldos após transação:', error);
      }
    }, 0);

    stateSetters.setJustTransferred(true);

    // 5. Atualiza histórico de transações do pagante
    const payerKey = `transactions_${userId}`;
    const payerHistory = JSON.parse(localStorage.getItem(payerKey) || '[]');
    const newTx: Transaction = {
      id: payerHistory.length > 0 ? Math.max(...payerHistory.map((t: any) => t.id)) + 1 : 1,
      amount: -Math.abs(Number(data.amount) / 100),
      status: 'success' as const,
      date: txDate,
      recipient: data.originalIdentifier || String(resolvedToId),
    };
    const updatedTxs = [...payerHistory, newTx];
    localStorage.setItem(payerKey, JSON.stringify(updatedTxs));
    console.log('Salvo no localStorage:', updatedTxs);
    // Atualiza o estado com o array mais recente do localStorage
    const freshTxs = JSON.parse(localStorage.getItem(payerKey) || '[]');
    stateSetters.setTransactions(() => freshTxs);
    
    // 6. Atualiza histórico do destinatário
    if (userId !== resolvedToId) {
      const recipientKey = `transactions_${resolvedToId}`;
      const recipientHistory = JSON.parse(localStorage.getItem(recipientKey) || '[]');
      const receiveTx = {
        id: recipientHistory.length > 0 ? Math.max(...recipientHistory.map((t: any) => t.id)) + 1 : 1,
        amount: Math.abs(Number(data.amount) / 100), // sempre positivo
        status: 'success',
        date: txDate,
        recipient: `Recebido de ${String(userId)}`,
      };
      
      // Atualiza o histórico do destinatário
      const updatedRecipientTxs = [receiveTx, ...recipientHistory];
      localStorage.setItem(recipientKey, JSON.stringify(updatedRecipientTxs));
      
      // Força atualização para o destinatário
      window.dispatchEvent(new StorageEvent('storage', { 
        key: recipientKey,
        newValue: JSON.stringify(updatedRecipientTxs),
        oldValue: JSON.stringify(recipientHistory)
      }));
    }

    // 7. Cria recebível para o destinatário
    try {
      await api.createReceivable({ 
        user_id: resolvedToId, 
        amount: Number(data.amount), 
        premint: true 
      });
    } catch (e: any) {
      if (!(e.message && e.message.includes('Failed to create receivable'))) {
        console.error('Erro ao criar recebível:', e);
      }
    }

    // 8. Atualiza UI (comprovante e botão compartilhar)
    stateSetters.setLastReceiptTx({ 
      amount: Number(data.amount) / 100, 
      status: 'success', 
      date: txDate, 
      recipient: String(resolvedToId),
      method: safeMethodStr
    });
    stateSetters.setShowShareButtons(true);

    stateSetters.setPollingBlocked(true);
    setTimeout(() => stateSetters.setPollingBlocked(false), 3000);

    return `Transferência via ${safeMethodStr} realizada com sucesso!`;
  } catch (error) {
    stateSetters.setJustTransferred(false);
    console.error('Erro no handleTransaction:', error);
    stateSetters.setError('Erro ao processar a transação. Por favor, tente novamente.');
    stateSetters.setShowShareButtons(false);
    console.error('Erro detalhado na transferência PIX:', error);
    throw error;
  }
};

async function generateReceiptPDF({ amount, recipient, date, method }: ReceiptData) {
  try {
    const existingPdfBytes = await fetch('/Comprovante background.pdf').then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Centralizar informações no topo do PDF
    const { width } = firstPage.getSize();
    
    // Formatar a data para o padrão brasileiro
    const formattedDate = new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Formatar o valor para o padrão brasileiro
    const formattedAmount = (amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    // Buscar informações do destinatário
    let recipientInfo = recipient;
    try {
      const userInfo = await api.getUserInfo(recipient);
      if (userInfo && userInfo.handle) {
        recipientInfo = `${userInfo.handle} (ID: ${userInfo.id})`;
      }
    } catch (error) {
      console.warn('Erro ao buscar informações do destinatário:', error);
    }

    const lines = [
      `COMPROVANTE DE TRANSFERÊNCIA`,
      `Valor: ${formattedAmount}`,
      `Destinatário: ${recipientInfo}`,
      `Data: ${formattedDate}`,
      `Método: ${method || 'Não especificado'}`
    ];

    // Posicionar as linhas no PDF
    let y = 750;
    lines.forEach((text, i) => {
      const size = i === 0 ? 28 : 18; // Título maior
      const textWidth = font.widthOfTextAtSize(text, size);
      firstPage.drawText(text, {
        x: (width - textWidth) / 2,
        y: y - i * 30,
        size,
        font,
        color: rgb(1, 1, 1)
      });
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comprovante_${formattedDate.replace(/[\/\s:]/g, '_')}.pdf`;
    link.click();
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha ao gerar o comprovante');
  }
}

// Função para resolver o ID do usuário a partir de identificadores diversos
const resolveUserId = async (identifier: string) => {
  console.log('resolveUserId - identificador recebido:', JSON.stringify(identifier));
  // 1. Tenta encontrar no banco local
  const localUser = userDb.getUserByIdentifier(identifier);
  if (localUser && localUser.id) {
    console.log('Usuário encontrado no banco local:', localUser);
    return Number(localUser.id);
  }

  // 2. Se não encontrar, tenta buscar na API
  if (/^\d+$/.test(identifier)) return Number(identifier);
  const user = await api.getUserInfo(identifier);
  if (user && user.id) return user.id;

  throw new Error('Usuário não encontrado');
};

export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', content: 'Welcome to your dashboard!' },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [input, setInput] = useState('');
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showShareButtons, setShowShareButtons] = useState(false);
  const [lastReceiptTx, setLastReceiptTx] = useState<ReceiptInfo | null>(null);
  const [showMethodButtons, setShowMethodButtons] = useState(false);
  const [pendingMethodData, setPendingMethodData] = useState<any>(null);
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const [pollingBlocked, setPollingBlocked] = useState(false);
  const [justTransferred, setJustTransferred] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Carregar userId ao montar o componente
  useEffect(() => {
    const storedId = localStorage.getItem('userId');
    if (storedId) {
      console.log('UserId carregado:', storedId);
      setUserId(Number(storedId));
    } else {
      console.log('UserId não encontrado no localStorage');
      router.push('/login');
    }
  }, [router]);

  // Busque o saldo da API apenas uma vez no carregamento inicial
  useEffect(() => {
    if (userId) {
      const fetchBalance = async () => {
        try {
          const info = await api.getUserInfo(String(userId));
          console.log('Informações completas do usuário:', info);
          if (info && typeof info.balance === 'number') {
            const balanceInCents = Math.round(info.balance * 100); // Converte para centavos
            setBalance(balanceInCents);
            console.log('Saldo inicial atualizado (em centavos):', balanceInCents);
          } else {
            console.error('Saldo não encontrado ou inválido:', info);
          }
        } catch (error) {
          console.error('Erro ao buscar saldo inicial:', error);
        }
      };
      fetchBalance();
    }
  }, [userId]);

  // Polling para atualizar o saldo periodicamente
  useEffect(() => {
    if (!userId || pollingBlocked) return;
    
    const fetchLatestBalance = async () => {
      try {
        const info = await api.getUserInfo(String(userId));
        console.log('Informações do usuário via polling:', info);
        if (info && typeof info.balance === 'number') {
          const balanceInCents = Math.round(info.balance * 100); // Converte para centavos
          setBalance(balanceInCents);
          console.log('Saldo atualizado via polling (em centavos):', balanceInCents);
        } else {
          console.error('Saldo não encontrado ou inválido via polling:', info);
        }
      } catch (error) {
        console.error('Erro ao buscar saldo via polling:', error);
      }
    };

    const interval = setInterval(fetchLatestBalance, 5000);
    return () => clearInterval(interval);
  }, [userId, pollingBlocked]);

  useEffect(() => {
    // Detecta se a última mensagem do agente é a pergunta de compartilhar comprovante
    if (messages.length > 0 && messages[messages.length - 1].role === 'agent') {
      const last = messages[messages.length - 1].content;
      setShowSharePrompt(last.includes('Deseja compartilhar o comprovante'));
    } else {
      setShowSharePrompt(false);
    }
  }, [messages]);

  // Buscar informações do usuário logado
  useEffect(() => {
    if (userId) {
      api.getUserInfo(String(userId)).then((info) => {
        setUserInfo(info);
      });
    }
  }, [userId]);

  // Carregar histórico ao montar
  useEffect(() => {
    if (userId) {
      const txKey = `transactions_${userId}`;
      const savedTxs = localStorage.getItem(txKey);
      if (savedTxs) {
        try {
          const parsedTxs = JSON.parse(savedTxs);
          setTransactions(parsedTxs);
          console.log('Histórico carregado:', parsedTxs);
        } catch (e) {
          console.error('Erro ao carregar histórico:', e);
        }
      }
    }
  }, [userId]);

  // Polling para atualizar histórico
  useEffect(() => {
    if (!userId || pollingBlocked) return;
    
    const fetchLatestTransactions = async () => {
      try {
        const txKey = `transactions_${userId}`;
        const savedTxs = localStorage.getItem(txKey);
        if (savedTxs) {
          const parsedTxs = JSON.parse(savedTxs);
          setTransactions(parsedTxs);
          console.log('Histórico atualizado via polling:', parsedTxs);
        }
      } catch (error) {
        console.error('Erro ao atualizar histórico via polling:', error);
      }
    };

    const interval = setInterval(fetchLatestTransactions, 5000);
    return () => clearInterval(interval);
  }, [userId, pollingBlocked]);

  // Salvar histórico quando mudar
  useEffect(() => {
    if (userId && transactions.length > 0) {
      const txKey = `transactions_${userId}`;
      localStorage.setItem(txKey, JSON.stringify(transactions));
      console.log('Histórico salvo:', transactions);
    }
  }, [transactions, userId]);

  useEffect(() => {
    if (!userId) return;
    const txKey = `transactions_${userId}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key === txKey) {
        const savedTxs = localStorage.getItem(txKey);
        if (savedTxs) {
          setTransactions(JSON.parse(savedTxs));
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  useEffect(() => {
    if (justTransferred && userId) {
      const txKey = `transactions_${userId}`;
      const savedTxs = localStorage.getItem(txKey);
      if (savedTxs) {
        try {
          const parsedTxs = JSON.parse(savedTxs);
          console.log('Atualizando estado transactions:', parsedTxs);
          setTransactions(parsedTxs);
        } catch (e) {
          // ignora
        }
      }
    }
  }, [justTransferred, userId]);

  const handleSend = async () => {
    if (!input.trim() || !userId) return;
    setMessages(msgs => [...msgs, { role: 'user', content: input.trim() }]);
    setInput('');
    setIsLoading(true);

    // Parser do comando
    let match = input.match(/(transfira|transferir|pague)\s*R?\$?(\d+)\s*para\s*(\S+)/i);
    if (match) {
      const valor = Number(match[2]) * 100;
      const destinatario = match[3];
      try {
        const to_user_id = await resolveUserId(destinatario);
        setPendingTransaction({ amount: valor, to_user_id, originalIdentifier: destinatario });
        setShowMethodButtons(true);
        setMessages(msgs => [
          ...msgs,
          { role: 'agent', content: 'Qual método deseja usar para a transferência?' }
        ]);
      } catch (e) {
        setMessages(msgs => [
          ...msgs,
          { role: 'agent', content: 'Usuário de destino não encontrado.' }
        ]);
      }
      setIsLoading(false);
      return;
    }
    setMessages(msgs => [
      ...msgs,
      { role: 'agent', content: 'Comando não reconhecido. Tente: transfira R$50 para 2955' }
    ]);
    setIsLoading(false);
  };

  const handleMethodClick = async (method: string) => {
    if (!pendingTransaction) return;
    if (!method) {
      setMessages(msgs => [
        ...msgs,
        { role: 'agent', content: 'Método de pagamento não especificado. Por favor, escolha um dos botões.' }
      ]);
      return;
    }
    setIsLoading(true);
    try {
      let resultMsg = '';
      const safeUserId = typeof userId === 'number' ? userId : 0;
      const safeToUserId = typeof pendingTransaction?.to_user_id === 'number' ? pendingTransaction.to_user_id : 0;
      const safeAmount = pendingTransaction?.amount ?? 0;
      const safeBalance = balance ?? 0;
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeMethodStr: string = method || '';

      const stateSetters = {
        setBalance,
        setTransactions,
        setShowShareButtons,
        setLastReceiptTx,
        setError,
        setJustTransferred,
        setPollingBlocked
      };

      if (safeMethodStr === 'PIX') {
        resultMsg = await handleTransaction(
          safeUserId,
          safeToUserId,
          { amount: safeAmount, originalIdentifier: pendingTransaction.originalIdentifier },
          safeMethodStr,
          safeBalance,
          safeDate,
          stateSetters,
          transactions
        );
      } else if (safeMethodStr === 'POS') {
        resultMsg = await handleTransaction(
          safeUserId,
          safeToUserId,
          { amount: safeAmount, originalIdentifier: pendingTransaction.originalIdentifier },
          safeMethodStr,
          safeBalance,
          safeDate,
          stateSetters,
          transactions
        );
      } else if (safeMethodStr === 'LINK') {
        resultMsg = await handleTransaction(
          safeUserId,
          safeToUserId,
          { amount: safeAmount, originalIdentifier: pendingTransaction.originalIdentifier },
          safeMethodStr,
          safeBalance,
          safeDate,
          stateSetters,
          transactions
        );
      } else if (safeMethodStr === 'CARTÃO' || safeMethodStr === 'CARTAO' || safeMethodStr === 'CARD') {
        resultMsg = await handleTransaction(
          safeUserId,
          safeToUserId,
          { amount: safeAmount, originalIdentifier: pendingTransaction.originalIdentifier },
          safeMethodStr,
          safeBalance,
          safeDate,
          stateSetters,
          transactions
        );
      } else {
        setMessages(msgs => [
          ...msgs,
          { role: 'agent', content: 'Método não reconhecido. Por favor, escolha um dos botões.' }
        ]);
        setIsLoading(false);
        return;
      }
      setMessages(msgs => [
        ...msgs,
        { role: 'agent', content: resultMsg },
        { role: 'agent', content: 'Deseja compartilhar o comprovante da transferência?' }
      ]);
      setShowSharePrompt(true);
      setPendingTransaction(null);
      setShowMethodButtons(false);
    } catch (err) {
      setMessages(msgs => [
        ...msgs,
        { role: 'agent', content: 'Erro ao processar a transferência.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Adicione este useEffect para depuração:
  useEffect(() => {
    console.log('Novo valor de balance:', balance);
  }, [balance]);

  // Dentro do componente DashboardPage, mas fora do return:
  useEffect(() => {
    console.log('RENDER: balance exibido:', balance);
  }, [balance]);

  // Adicione o handler para os botões Sim/Não
  const handleShareResponse = (response: boolean) => {
    setShowSharePrompt(false);
    setMessages(msgs => [
      ...msgs,
      { role: 'user', content: response ? 'Sim' : 'Não' },
      { role: 'agent', content: response ? 'Comprovante gerado e baixado com sucesso (PDF)!' : 'Ok, comprovante não compartilhado.' }
    ]);
    if (response && lastReceiptTx) {
      generateReceiptPDF({
        amount: lastReceiptTx.amount * 100,
        recipient: lastReceiptTx.recipient,
        date: lastReceiptTx.date,
        method: lastReceiptTx.method || ''
      });
    }
  };

  // Handler para logoff
  const handleLogoff = () => {
    localStorage.removeItem('userId');
    router.push('/login');
  };

  console.log('transactions no render:', transactions);
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
      <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-30 z-0" />
      {/* Layout principal */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center font-sans bg-transparent">
        <div className="flex flex-row items-center justify-center w-full h-[90vh] gap-16 max-w-screen-xl mx-auto">
          {/* Sidebar */}
          <aside className="w-28 h-screen flex flex-col items-center justify-start pt-8 bg-white/20 backdrop-blur-3xl shadow-2xl rounded-tr-4xl rounded-br-4xl py-10 fixed left-0 top-0 z-20">
            <div className="flex flex-col items-center gap-10 h-full">
              <img src="/CloudWalk-logo2.png" alt="Logo" className="w-24 h-12 object-contain mx-auto my-4 drop-shadow-2xl" />
              <nav className="flex flex-col gap-8 items-center">
                {/* Chat icon */}
                <div className="relative group flex flex-col items-center">
                  <span className="cursor-pointer hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-200" title="Chat">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} width={40} height={40}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 0 1-4-.8L3 21l1.8-4A8.96 8.96 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                  </span>
                </div>
                {/* Card icon */}
                <div className="relative group flex flex-col items-center">
                  <span className="cursor-pointer hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-200" title="Card">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} width={40} height={40}>
                      <rect x="3" y="7" width="18" height="10" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
                    </svg>
                  </span>
                </div>
                {/* Dollar icon */}
                <div className="relative group flex flex-col items-center">
                  <span className="cursor-pointer hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-200" title="Money">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} width={40} height={40}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12v2m0 14v-2"/>
                    </svg>
                  </span>
                </div>
                {/* Link icon */}
                <div className="relative group flex flex-col items-center">
                  <span className="cursor-pointer hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-200" title="Link">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2} width={40} height={40}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 1 0 5.656l-3.535 3.535a4 4 0 1 1-5.657-5.657l1.414-1.414m6.364-6.364a4 4 0 0 1 5.657 5.657l-1.414 1.414"/>
                    </svg>
                  </span>
                </div>
              </nav>
            </div>
          </aside>
          {/* Chat central */}
          <main className="flex flex-col items-center justify-center flex-[2.2] h-[90vh] ml-36">
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-full max-w-5xl h-full bg-white/20 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl p-16 flex flex-col gap-16 justify-center items-center">
                <div className="w-full flex flex-col gap-6 flex-1 justify-center overflow-y-auto h-full p-0 custom-scrollbar">
                  {messages.map((msg, idx) => {
                    // Mensagem de compartilhar comprovante
                    if (
                      msg.role === 'agent' &&
                      msg.content.toLowerCase().includes('deseja compartilhar o comprovante')
                    ) {
                      return (
                        <div key={idx} className="flex justify-start">
                          <span className="bg-white/70 text-gray-900 shadow-lg rounded-[1.5rem] px-8 py-5 text-lg font-medium backdrop-blur-2xl flex items-center justify-between gap-4 max-w-[75%] break-words w-full">
                            <span className="break-words">{msg.content}</span>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                              <path d="M15 8a3 3 0 1 0-6 0v8a3 3 0 1 0 6 0V8zm6 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#6366F1" strokeWidth="2"/>
                              <path d="M12 8v8m0 0l3-3m-3 3l-3-3" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        </div>
                      );
                    }
                    // Mensagem normal
                    return (
                      <div key={idx} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                        <span
                          className={
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-xl rounded-[1.5rem] px-8 py-5 text-lg font-medium break-words max-w-[75%] transition-all duration-200 backdrop-blur-2xl border border-white/30'
                              : 'bg-white/30 text-gray-900 shadow-xl rounded-[1.5rem] px-8 py-5 text-base font-medium backdrop-blur-2xl border border-white/30 break-words max-w-[75%] transition-all duration-200'
                          }
                        >
                          {msg.content}
                        </span>
                      </div>
                    );
                  })}
                  {/* Botões de método de transferência */}
                  {showMethodButtons && pendingTransaction && (
                    <div className="flex flex-wrap gap-4 justify-center mt-4">
                      {['PIX', 'POS', 'Link', 'Cartão'].map((method) => (
                        <button
                          key={method}
                          className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full font-bold text-lg shadow-lg hover:from-indigo-600 hover:to-blue-600 transition-transform hover:scale-105 disabled:opacity-60"
                          onClick={() => handleMethodClick(method)}
                          disabled={isLoading}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Botões Sim/Não para compartilhar comprovante */}
                {showSharePrompt && (
                  <div className="flex justify-start w-full mt-4">
                    <span className="bg-white/70 text-gray-900 shadow-lg rounded-[1.5rem] px-8 py-5 text-base font-medium backdrop-blur-2xl max-w-[75%] flex items-center gap-4">
                      <span className="mr-4">Deseja compartilhar o comprovante da transferência?</span>
                      <button
                        className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 font-semibold shadow-lg transition-transform hover:scale-105 text-base"
                        onClick={() => handleShareResponse(true)}
                      >
                        Sim
                      </button>
                      <button
                        className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 font-semibold shadow-lg transition-transform hover:scale-105 text-base"
                        onClick={() => handleShareResponse(false)}
                      >
                        Não
                      </button>
                    </span>
                  </div>
                )}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-4 mt-8 w-full"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    className="flex-1 rounded-full border-2 border-white/30 px-8 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white/70 text-lg shadow font-medium placeholder-gray-500 backdrop-blur-2xl custom-scrollbar"
                    placeholder="Type your message..."
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-full hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 font-semibold shadow-lg transition-transform hover:scale-105 text-lg"
                    disabled={isLoading}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </main>
          {/* Painel direito */}
          <aside className="flex flex-col justify-center items-center max-w-xs w-full h-[90vh] bg-white/20 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl p-8 font-sans">
            <div className="w-full h-full flex flex-col justify-between">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-white font-bold text-xl tracking-tight mb-1">
                    Conta: <span className="text-white font-bold">@{userInfo?.handle || '-'}</span>
                  </div>
                  <div className="text-white text-base mb-1">
                    ID: <span className="text-white">{userInfo?.id || '-'}</span>
                  </div>
                  <div className="text-white text-xs break-all">
                    PIX: <span className="text-white">{userInfo?.pix_key || userInfo?.email || userInfo?.cpf || '-'}</span>
                  </div>
                </div>
                <button onClick={handleLogoff} className="bg-white/90 hover:bg-white text-gray-900 px-6 py-2 rounded-full font-semibold text-base shadow-lg transition-all duration-200 hover:scale-105">Logoff</button>
              </div>
              <div className="mb-8">
                <div className="text-white text-2xl font-bold tracking-tight mb-1">Current Balance</div>
                <div className="text-5xl font-extrabold tracking-tight text-white mb-1">R$<span className="ml-2">{(balance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="text-white text-lg font-bold tracking-tight mb-4">Transaction History</div>
                <div className="rounded-[1.5rem] bg-white/10 backdrop-blur-xl p-1 max-h-[300px] overflow-y-auto custom-scrollbar mb-8">
                  <ul className="space-y-3">
                    {transactions.length === 0 ? (
                      <li className="text-white text-base">No transactions yet.</li>
                    ) : (
                      transactions.map((tx) => (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between rounded-[1.5rem] px-6 py-4 shadow-xl bg-white/20 backdrop-blur-2xl border border-white/30 hover:bg-white/30 transition-all duration-200"
                        >
                          <div className="flex flex-col min-w-[110px]">
                            <span className={`font-bold text-xl ${tx.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                              {tx.amount < 0 ? '- ' : '+ '}
                              R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-gray-800 text-base">
                              {tx.amount < 0 ? 'Enviado para: ' : 'Recebido de: '}
                              {tx.recipient}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-gray-600 text-xs whitespace-nowrap">{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                            <span className={`text-xs whitespace-nowrap px-2 py-1 rounded-full ${
                              tx.status === 'success' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tx.status === 'success' ? 'Concluída' : 'Falha'}
                            </span>
                          </div>
                          <span className="ml-2 text-xl cursor-pointer hover:opacity-80 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-gray-600">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 1 0-6 0v8a3 3 0 1 0 6 0V8zm6 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m0 0l3-3m-3 3l-3-3" />
                            </svg>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
} 