<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A password change must prove the current password, so a stolen token
 * alone cannot lock the real owner out of their own account.
 */
class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => [
                'required',
                'string',
                'min:8',
                'max:200',
                'confirmed',
                // Laravel's default is a checksum over the whole alphabet,
                // which any readable password passes. Require a real mix.
                'different:current_password',
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/[0-9]/',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.required' => 'Enter your current password to confirm the change.',
            'password.confirmed' => 'The two new passwords do not match.',
            'password.different' => 'Choose a password you have not used here before.',
            'password.regex' => 'Use at least 8 characters with an uppercase letter, a lowercase letter and a number.',
        ];
    }
}
