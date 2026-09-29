<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'is_dark_mode' => ['required', 'boolean'],
            'email_alerts' => ['required', 'boolean'],
            'timezone' => ['required', 'string', 'timezone'],
            'locale' => ['required', 'string', 'max:8'],
        ];
    }
}
