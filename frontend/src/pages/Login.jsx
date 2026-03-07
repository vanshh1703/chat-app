import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../api/api';

function Login() {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.signIn(formData);
            localStorage.setItem('profile', JSON.stringify(data));
            navigate('/home');
        } catch (err) {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className='bg-slate-100 h-screen w-screen flex items-center justify-center font-sans px-4'>
            <div className='bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200'>
                <h2 className='text-3xl font-extrabold mb-8 text-center text-blue-600'>Welcome Back</h2>
                {error && <p className="text-red-500 text-xs mb-4 text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                <form onSubmit={handleLogin}>
                    <div className='mb-4'>
                        <label className='block text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider' htmlFor='username'>Username</label>
                        <input
                            className='bg-slate-50 border border-slate-200 rounded-xl w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
                            id='username' type='text' placeholder='Enter your username'
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>
                    <div className='mb-6'>
                        <label className='block text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider' htmlFor='password'>Password</label>
                        <input
                            className='bg-slate-50 border border-slate-200 rounded-xl w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
                            id='password' type='password' placeholder='••••••••'
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>
                    <button className='w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]' type='submit'>
                        Sign In
                    </button>
                    <p className="mt-6 text-center text-slate-500 text-sm">
                        Don't have an account? <Link to="/register" className="text-blue-600 font-bold hover:underline">Sign up</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default Login;
