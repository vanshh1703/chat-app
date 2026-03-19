import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../api/api';

function Register() {
    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const updateField = (field, value) => {
        setError('');
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const payload = {
            username: formData.username.trim(),
            email: formData.email.trim().toLowerCase(),
            password: formData.password
        };

        if (!payload.username || !payload.email || !payload.password) {
            setError('Please fill out all required fields.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await api.signUp(payload);
            navigate('/');
        } catch (err) {
            const message = err?.response?.data?.error || err?.response?.data?.message;
            setError(message || 'Registration failed. Username or email may be taken.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='bg-slate-100 h-screen w-screen flex items-center justify-center font-sans px-4'>
            <div className='bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200'>
                <h2 className='text-3xl font-extrabold mb-8 text-center text-blue-600'>Create Account</h2>
                {error && <p className="text-red-500 text-xs mb-4 text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                <form onSubmit={handleRegister}>
                    <div className='mb-4'>
                        <label className='block text-slate-700 text-xs font-bold mb-2 uppercase tracking-wider' htmlFor='username'>Username</label>
                        <input
                            className='bg-slate-50 border border-slate-200 rounded-xl w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
                            id='username' type='text' placeholder='Choose a username'
                            value={formData.username}
                            onChange={(e) => updateField('username', e.target.value)}
                            autoComplete='username'
                            required
                        />
                    </div>
                    <div className='mb-4'>
                        <label className='block text-slate-700 text-xs font-bold mb-2 uppercase tracking-wider' htmlFor='email'>Email Address</label>
                        <input
                            className='bg-slate-50 border border-slate-200 rounded-xl w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
                            id='email' type='email' placeholder='name@company.com'
                            value={formData.email}
                            onChange={(e) => updateField('email', e.target.value)}
                            autoComplete='email'
                            required
                        />
                    </div>
                    <div className='mb-6'>
                        <label className='block text-slate-700 text-xs font-bold mb-2 uppercase tracking-wider' htmlFor='password'>Password</label>
                        <input
                            className='bg-slate-50 border border-slate-200 rounded-xl w-full py-3 px-4 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
                            id='password' type='password' placeholder='••••••••'
                            value={formData.password}
                            onChange={(e) => updateField('password', e.target.value)}
                            autoComplete='new-password'
                            minLength={6}
                            required
                        />
                    </div>
                    <button
                        className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]'
                        type='submit'
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Creating Account...' : 'Register Now'}
                    </button>
                    <p className="mt-6 text-center text-slate-600 text-sm">
                        Already have an account? <Link to="/" className="text-blue-600 font-bold hover:underline">Log in</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}

export default Register