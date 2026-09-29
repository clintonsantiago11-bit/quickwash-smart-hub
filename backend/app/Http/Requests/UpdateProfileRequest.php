<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the fields an operator may change about themselves.
 *
 * The email is checked for uniqueness against every other account, ignoring
 * the caller's own row so saving an unchanged form is not rejected. Role,
 * facility, username and password are not accepted here at all — they are
 * not part of a self-service profile.
 */
class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => [
                'required',
                'string',
                'email:rfc',
                'max:100',
                Rule::unique('users', 'email')->ignore($this->user()->id),
            ],
            // `sometimes` so an omitted key is left alone rather than nulled.
            'phone' => ['sometimes', 'nullable', 'string', 'max:20', 'regex:/^[0-9+()\-.\s]+$/'],
            'designation' => ['sometimes', 'nullable', 'string', 'max:100'],
            'avatar_url' => ['sometimes', 'nullable', 'string', 'url', 'max:2048'],
        ];
    }

    /**
     * The columns to actually persist.
     *
     * `designation` is NOT NULL with a column default. MySQL only applies a
     * default when the column is omitted entirely, so writing an explicit
     * null fails — clearing the field in the UI has to store an empty string
     * instead. phone and avatar_url are genuinely nullable.
     */
    public function profileAttributes(): array
    {
        $data = $this->validated();

        if (array_key_exists('designation', $data) && $data['designation'] === null) {
            $data['designation'] = '';
        }

        return $data;
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'That email address is already in use by another account.',
            'phone.regex' => 'Enter a valid phone number.',
            'full_name.min' => 'Your name needs at least 2 characters.',
        ];
    }

    /** Trim before validation so "  a@b.com  " is not silently stored. */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'full_name' => is_string($this->full_name) ? trim($this->full_name) : $this->full_name,
            'email' => is_string($this->email) ? strtolower(trim($this->email)) : $this->email,
            'phone' => is_string($this->phone) ? trim($this->phone) : $this->phone,
            'designation' => is_string($this->designation) ? trim($this->designation) : $this->designation,
        ]);
    }
}
