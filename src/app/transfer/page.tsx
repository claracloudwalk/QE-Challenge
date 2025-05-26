import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../services/api';

export default function TransferPage() {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('debit');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Função para buscar o saldo atualizado após a transferência
  const fetchAndUpdateBalance = async () => {
    const storedId = localStorage.getItem('userId');
    if (!storedId) return;
    try {
      const userBalance = await api.getBalance(Number(storedId));
      // Se quiser atualizar o saldo em algum estado global/contexto, faça aqui
      // Exemplo: setBalance(userBalance);
      console.log('Saldo atualizado após transferência:', userBalance);
    } catch (err) {
      console.error('Erro ao buscar saldo atualizado:', err);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.transferMoney({
        to_user_id: 125300,
        amount: parseFloat(amount),
        payment_method: paymentMethod as 'debit' | 'credit',
      });

      // Buscar saldo atualizado após a transferência
      const storedId = localStorage.getItem('userId');
      if (storedId) {
        const userId = Number(storedId);
        const userBalance = await api.getBalance(userId);
        // Atualizar o saldo do usuário pagante usando o endpoint POST /users/set-balance
        await api.setBalance({ user_id: userId, balance: userBalance });
        console.log('Saldo atualizado via set-balance:', userBalance);
      }

      setSuccess('Transfer completed successfully!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError('Failed to complete transfer. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Send Money</h1>

        <form onSubmit={handleTransfer} className="space-y-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount (R$)
            </label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>

          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="debit">Debit Card</option>
              <option value="credit">Credit Card</option>
            </select>
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          {success && (
            <div className="text-green-500 text-sm">{success}</div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Send Money
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 