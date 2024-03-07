'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn } from '../auth';
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: "'Please select an invoice status.'",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  date: z.string(),
});
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateSchema = FormSchema.omit({ id: true, date: true });
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  const { amount, customerId, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    console.error(error, 'Error adding...');
    return {
      message: 'Failed to add new invoice..',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export default async function editInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateSchema.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const date = new Date().toISOString().split('T')[0];

  const amountInCents = amount * 100;
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(error, 'Error updating,,');
    return {
      message: 'Failed to update new invoice..',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`
    DELETE FROM invoices where id=${id}`;
    return {
      message: 'delete invoice successfully',
    };
  } catch (error) {
    console.error(error, 'Error delete invoice..');
    return {
      message: 'Failed to delete invoice..',
    };
  }
  revalidatePath('/dashboard/invoices');
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
